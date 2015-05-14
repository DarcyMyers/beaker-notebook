(ns bunsen.marketplace.api.models.datasets
  (:require [bunsen.marketplace.helper.api :as helper]
            [bunsen.marketplace.base :as base]
            [bunsen.common.helper.utils :as u]
            [bunsen.marketplace.api.models.categories :as category]
            [bunsen.marketplace.api.domain :as domain]
            [bunsen.marketplace.simple.simple :as simple]
            [bunsen.marketplace.api.models.ratings :as ratings]
            [clojurewerkz.elastisch.rest.document :as doc]
            [clojure.string :as str]
            [datomic.api :as d]))

(defn create-datasets
  "Returns true if datasets payload was succesfully sent to
  ElasticSearch, false otherwise."
  [es-conn index-name payload]
  (let [datasets (:datasets payload)
        categories (base/read-indexed-results es-conn index-name "categories")
        indexer (base/index! es-conn index-name "datasets" datasets
                             identity ; json already parsed
                             #(map (partial simple/prepare-dataset categories) %)
                             base/bulk-to-es!)]
    (await-for 5000 indexer)
    (= (:stage @indexer) :indexed)))

(defn create-dataset
  "Creates a single dataset based on the index-name provided"
  [config index-name document]
  (let [connection (helper/connect-to-es config)
        created_id (:_id (doc/create connection index-name "datasets" document))]
    ; set the ID attribute of a dataset to be the internal elastic search _id
    ; since the api consumers expect their to be an ID attribute on each dataset.
    (doc/update-with-partial-doc connection index-name "datasets" created_id {:id created_id})
    (domain/background-update-counts connection index-name)))

(defn delete-dataset
  [config index-name id]
  (let [connection (helper/connect-to-es config)]
    (doc/delete connection index-name "datasets" id)
    (domain/background-update-counts connection index-name)))

(defn update-dataset
  "Updates dataset with given payload"
  [config index-name id document]
  (let [connection (helper/connect-to-es config)]
    (doc/put connection index-name "datasets" id document)
    (domain/background-update-counts connection index-name)))

(defn extract-catalog-path [category-path]
  (if (nil? category-path) "0.1"
    (->> (str/split category-path #"\.") (take 2) (interpose ".") str/join)))

(defn dataset-catalog-path
  [dataset]
  (let [category (-> dataset :categories first)]
    (extract-catalog-path (:path category))))

(defn metadata-indexes
  [metadata type]
  (keys (filter #(= (-> % second :indexes first) type) metadata)))

(defn category-path-filter
  [cat-path]
  {:bool {:should [{:term {:categories.path cat-path}} {:prefix {:categories.path (str cat-path ".")}}]}})

(defn filter-terms
  [k v]
  {:terms {:execution "and" (keyword k) v}})

(defn filter-term
  [k v]
  {:term {(keyword k) v}})

(defn must-filters
  [fields params]
  (let [filters [(category-path-filter (or (:category-path params) "0"))]
        fields-in-params (into {} (map #(when ((keyword %) params)
                                          {(keyword %) ((keyword %) params)})
                                       fields))]
    (conj filters (reduce-kv (fn [m k v] (if (vector? v)
                                           (conj m (filter-terms k v))
                                           (conj m (filter-term k v))))
                             {}
                             fields-in-params))))

(defn must-not-filters
  [params]
  (if (:exclude params)
    [{:ids {:values [(:exclude params)]}}]
    []))

(defn must-queries [text-fields query]
  (map (fn [query] {:multi_match {:query (val query)
                                  :type "phrase_prefix"
                                  :fields text-fields
                                  :operator "and"}})
       (select-keys query [:searchTerm :searchScope])))

(defn query-builder
  [catalog params]
  {:filtered {:query {:bool {:must (must-queries (metadata-indexes (:metadata catalog) "text") params)}}
              :filter {:bool {:must (must-filters (metadata-indexes (:metadata catalog) "filter") params)
                              :must_not (must-not-filters params)}}}})

(defn aggregators [fields] (apply merge (map #(hash-map % {:terms {:field %}}) fields)))

(defn transform-results [results]
  (let [transformed-results (mapv #(merge (:_source %) {:index (:_index %)}) (-> results :hits :hits))]
    {:data transformed-results :total-items (-> results :hits :total) :filters {}}))

(defn find-by-ids
  [es-conn ids]
  (let [query {:ids {:values ids}}
        results (doc/search es-conn
                            "*"
                            "datasets"
                            :size 10
                            :query query)]
    (transform-results results)))

(defn find-matching
  [db config index query]
  (let [es-conn (helper/connect-to-es config)
        category-path (:category-path query)
        catalog-path (extract-catalog-path category-path)
        catalog (category/fetch es-conn index catalog-path)
        catalog-filters (metadata-indexes (:metadata catalog) "filter")
        results (doc/search es-conn
                            index
                            "datasets"
                            :size (:size query)
                            :from (:from query)
                            :query (query-builder catalog query)
                            :sort [{:_score {:order "desc"}} {:raw_title {:order "asc"}}]
                            :aggs (aggregators catalog-filters))

        aggregations (:aggregations results)
        filters (apply merge (map (fn [catalog-filter]
                                    (hash-map catalog-filter
                                              (map #(:key %)
                                                   (:buckets (catalog-filter aggregations)))))
                                  catalog-filters))
        datasets (assoc (transform-results results) :filters filters)]
    (assoc datasets
           :data (map #(merge % (ratings/avg-rating db (str (:id %)) index ))
                      (:data datasets)))))

(defn dataset-users
  [db index-name data-set-id]
  (d/q '[:find [?ids ...]
         :in $ ?index-name ?data-set-id
         :where [?s :subscription/data-set-id ?data-set-id]
                [?s :subscription/index-name ?index-name]
                [?s :subscription/user-id ?ids]]
        db
        index-name
        data-set-id))

(defn subscribed?
  [data-set-id index-name ctx]
  (let [user-id (-> ctx :request :session :id)]
    (d/q '[:find ?s .
           :in $ ?index-name ?data-set-id ?user-id
           :where [?s :subscription/data-set-id ?data-set-id]
                  [?s :subscription/index-name ?index-name]
                  [?s :subscription/user-id ?user-id]]
         (-> ctx :request :db)
         index-name
         data-set-id
         (u/uuid-from-str user-id))))

(defn get-dataset
  [db config index-name id]
  (let [es-conn (helper/connect-to-es config)
        dataset (-> es-conn
                    (doc/get index-name "datasets" id)
                    :_source)
        catalog-path (dataset-catalog-path dataset)
        related (:data (find-matching db
                                      config
                                      index-name
                                      {:category-path catalog-path
                                       :tags (:tags dataset)
                                       :exclude id
                                       :size 5
                                       :from 0}))]
    (assoc dataset
           :catalog (category/fetch es-conn index-name catalog-path)
           :index index-name
           :subscriberIds (dataset-users db index-name id)
           :related related)))