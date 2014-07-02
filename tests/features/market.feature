Feature: Market Place Searching
As a researcher, I want to be able to use the market place.

  Background:
    Given I'm signed in as a researcher

  Scenario: See a market item
    When there is a market item
    And I view the market search
    Then I should see 1 market item on the market list page

  Scenario: Filtering market items by text
    When there is a market item
    And I view the market search
    And I filter the market page by "this will not match"
    Then I should see 0 market items on the market list page

  Scenario: Filtering market items by tag
    When there is a market item with the format "MAGIC"
    And there is a market item with the format "CSV"
    And I view the market search
    And I filter by search by selecting the "MAGIC" formats
    Then I should see 1 market item on the market list page

  Scenario: Filtering market items by format
    When there is a market item with the tags "cat,dog,human"
    And I view the market search
    And I filter by search by selecting the "cat,dog,human" tags
    Then I should see 1 market item on the market list page

  Scenario: Filtering market items by vendor
    When there is a market item with the vendor "George data"
    And there is a market item with the vendor "Doge industries"
    And I view the market search
    And I filter by search by selecting the "George data" vendors
    Then I should see 1 market item on the market list page

  Scenario: Stacking market item filters
    When there is a market item with the vendor "George data"
    And there is a market item with the format "MAGIC"
    And I view the market search
    And I filter by search by selecting the "George data" vendors
    Then I should see 1 market item on the market list page
    And I filter by search by selecting the "MAGIC" formats
    Then I should see 0 market items on the market list page
    And I filter the market page by "Credit"
    Then I should see 0 market items on the market list page

  Scenario: Paginated market items
    When there is 22 market items
    And I view the market search
    Then I should see 10 market items on the market list page
    And I should see 22 total results

  Scenario: Market place filter persistence
    When there is a market item with the tags "cat,dog,human"
    And I view the market search
    And I filter by search by selecting the "cat" tags
    And I view the first market item
    And I return to the market results
    Then I should see the "cat" tags selected

  Scenario: Tags and Category on main market nav are mutually exclusive
    Given I have the following categories:
      | name       | path |
      | Government |  0.1 |
    And there is a market item with the tags "cat,dog,human"
    And I view the market search
    And I filter by search by selecting the "cat" tags
    Then I should see the "cat" tags selected
    And I should see that no category is selected
    When I click "Government"
    Then I should see that no tags are selected

  Scenario: Market items text search
    Given I have the following market items:
      | title                  |
      | Credit Card Complaints |
      | Crime in Canada        |
    When I view the market search
    And I search marketplace by "canada"
    Then I should see 1 market item on the market list page
    And I should see the "Crime in Canada" market item on the market list page

  Scenario: Market items text search for non-matching term
    Given I have the following market items:
      | title                  |
      | Crime in Canada        |
    When I view the market search
    And I search marketplace by "crime in mexico"
    Then I should see 0 market items on the market list page

  Scenario: Clear market items text search
    Given I have the following market items:
      | title                  |
      | Credit Card Complaints |
      | Crime in Canada        |
    When I view the market search
    And I search marketplace by "canada"
    And I search marketplace by ""
    Then I should see 2 market items on the market list page

  Scenario: Related market items
    Given I have the following market items:
      | title                       | tags                      |
      | Quarterly E-commerce Report | finance,e-commerce        |
      | Amazon Annual Report        | amazon,e-commerce,finance |
      | The World Bank Report 2013  | finance,world bank        |
    And I view the market search
    When I view the "Quarterly E-commerce Report" market item
    Then I should see "Amazon Annual Report" is related
    When I view the "Amazon Annual Report" related item
    Then I should see no related items

  Scenario: Data set details description
    Given I have the following market items:
      | title                       | description                              |
      | Quarterly E-commerce Report | All revenue from e-commerce each quarter |
    And I view the market search
    When I view the "Quarterly E-commerce Report" market item
    Then I should see the market description "All revenue from e-commerce each quarter"

  Scenario: No more than 5 related market items
    Given I have the following market items:
      | title                       | tags                      |
      | Quarterly E-commerce Report | finance,e-commerce        |
      | Amazon Annual Report        | amazon,e-commerce,finance |
      | The World Bank Report 2013  | finance,food              |
      | Butter Futures              | finance,e-commerce        |
      | Hog Futures                 | e-commerce,finance        |
      | Wood Futures                | finance,e-commerce        |
      | Yearly e-commerce Report    | finance,e-commerce        |
    And I view the market search
    When I view the "Quarterly E-commerce Report" market item
    Then I should see "5" related items

  Scenario: Data set details vendor
    Given I have the following market items:
      | title           | vendors             |
      | Delta Quadrant  | Starship Voyager    |
    And I view the market search
    And I view the "Delta Quadrant" market item
    Then I should see the vendor "Starship Voyager"

  Scenario: Data set details format
    Given I have the following market items:
      | title                     | format |
      | US Electricity Statistics | CSV    |
    And I view the market search
    And I view the "US Electricity Statistics" market item
    Then I should see the format "CSV"

  Scenario: Data set details frequency
    Given I have the following market items:
      | title               | updateFrequency |
      | Crime Rates, Canada | Annually        |
    And I view the market search
    And I view the "Crime Rates, Canada" market item
    Then I should see the frequency "Annually"

  Scenario: Data set details tags
    Given I have the following market items:
      | title               | tags               |
      | Crime Rates, Canada | crime,stats,canada |
    And I view the market search
    And I view the "Crime Rates, Canada" market item
    Then I should see the tags "stats,crime,canada"

  Scenario: Market place related tags
    Given I have the following market items:
      | title                      | tags               |
      | Crime Rates, Canada        | crime,stats,canada |
      | Population in Canada       | census,canada      |
      | The World Bank Report 2013 | finance,world bank |
    When I view the market search
    And I filter the market page by "Canada"
    Then I should see the related tags "canada,census,stats,crime"

  Scenario: Market item description in list
    Given I have the following market items:
      | title                     | description                               | format | vendors |
      | crime rates, canada       | yearly crimes reported per 100,000 people | xml    |         |
    When I view the market search
    And I filter the market page by "crime"
    Then I should see the following market results
      | title                     | description                               | format | vendors |
      | crime rates, canada       | yearly crimes reported per 100,000 people | xml    |         |

  Scenario: Market item vendor in list
    Given I have the following market items:
      | title                     | description                               | format | vendors            |
      | crime rates, canada       | yearly crimes reported per 100,000 people | xml    | statistics canada  |
    When I view the market search
    And I filter the market page by "Canada"
    Then I should see the following market results
      | title                     | description                               | format | vendors            |
      | crime rates, canada       | yearly crimes reported per 100,000 people | xml    | statistics canada  |

  Scenario: Market item file path
    Given I have the following market items:
      | title               | remoteFile |
      | Crime Rates, Canada | CRIME.xml  |
    And I view the market search
    When I view the "Crime Rates, Canada" market item
    And I subscribe to the market item
    Then I should see the file path "/var/s3/CRIME.xml"

  Scenario: Category with a description
    Given I have the following categories:
      | name               | description                               | ownerName   | ownerEmail              | path     |
      | Energy             | Work and heat are two categories.         | Quentin     | quentin@twosigma.com    | 0.2      |
      | Government         | Description here woooo                    | Quentin H   | quentin11@twosigma.com  | 0.1      |
    When I view the market search
    And I click "Energy"
    Then I should see a category description

  Scenario: Category without a description
    Given I have the following categories:
      | name               | ownerName   | ownerEmail              | path     |
      | Government         | Quentin     | quentin@twosigma.com    | 0.1      |
    When I view the market search
    And I click "Government"
    Then I should not see a category description