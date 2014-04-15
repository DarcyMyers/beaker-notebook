/*
 *  Copyright 2014 TWO SIGMA INVESTMENTS, LLC
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
/**
 * M_bkNotebookEvaluators
 * This is the module for the UI that shows the list of evaluators and their corresponding
 * settings panel.
 */
(function() {
  'use strict';
  var bkNotebookEvaluators = angular.module('M_bkNotebookEvaluators', [
    'M_bkCore',
    'M_bkSessionManager'
  ]);

  bkNotebookEvaluators.directive('bkNotebookEvaluators', function(
      bkCoreManager, bkSessionManager, menuPluginManager) {
    return {
      restrict: 'E',
      templateUrl: "./template/bkNotebook_evaluators.html",
      controller: function($scope) {
        $scope.isHideEvaluators = function() {
          return bkCoreManager.getBkNotebook().getViewModel().isHideEvaluators();
        };
        $scope.hideEvaluators = function() {
          return bkCoreManager.getBkNotebook().getViewModel().hideEvaluators();
        };
        $scope.newEvaluatorName = "";
        $scope.getEvaluators = function() {
          //return evaluatorManager.getAllEvaluators();
        };
        $scope.getEvaluatorsAndLoadingPlugins = function() {
          //return evaluatorManager.getEvaluatorsAndLoadingPlugins();
        };
        $scope.getKnownEvaluators = function() {
          //return evaluatorManager.getKnownEvaluators();
        };
        $scope.addKnownEvaluator = function(name) {
          //$scope.newPluginUrl = evaluatorManager.nameToUrl[name];
        };
        $scope.newMenuPluginUrl = "./plugin/menu/debug.js";
        $scope.addMenuPlugin = function() {
          menuPluginManager.addMenu($scope.newMenuPluginUrl);
        };
        $scope.getMenuPlugins = function() {
          return menuPluginManager.getMenuPlugins();
        };
        $scope.newPluginUrl = "";
        $scope.addPlugin = function() {
          var pluginUrl = $scope.newPluginUrl;
          var makeEvaluator = function(Shell) {
            var newEvaluatorObj = {
              name: Shell.prototype.pluginName,
              plugin: pluginUrl
            };
            bkSessionManager.getRawNotebookModel().evaluators.push(newEvaluatorObj);
            bkCoreManager.addEvaluator(newEvaluatorObj);
          };
          //evaluatorManager.setupPlugin(pluginUrl, makeEvaluator);
        };
      }
    };
  });

  // TODO, we should not prefix our directives with 'ng' ever. This needs to be corrected.
  bkNotebookEvaluators.directive('ngEnter', function() {
    return function(scope, element, attrs) {
      element.bind("keydown keypress", function(event) {
        if (event.which === 13) {
          scope.$apply(function() {
            scope.$eval(attrs.ngEnter);
          });
          event.preventDefault();
        }
      });
    };
  });

  bkNotebookEvaluators.directive('bkNotebookEvaluatorsEvaluatorSettings', function(
      $compile, bkSessionManager) {
    return {
      restrict: 'E',
      template: '<div ng-show="evaluator.loading"><accordion-group heading="Loading {{evaluator.url}}...">' +
          '</accordion-group></div>' +
          '<div ng-hide="evaluator.loading"><accordion-group heading="{{evaluator.name}} (plugin: {{evaluator.evaluator.settings.plugin}})">' +
          '<div class="bbody"></div></accordion-group></div>',
      controller: function($scope) {
        $scope.set = function(val) {
          $scope.evaluator.evaluator.perform(val);
          bkSessionManager.setNotebookModelEdited(true);
        };
      },
      link: function(scope, element, attrs) {
        if (scope.evaluator.loading) return;
        var evaluator = scope.evaluator.evaluator;
        for (var property in evaluator.spec) {
          if (evaluator.spec.hasOwnProperty(property)) {
            var name = evaluator.spec[property].hasOwnProperty('name') ? evaluator.spec[property].name : property;
            if (evaluator.spec[property].type === "settableString") {
              element.find('.bbody').append($compile(
                  "<div>" + name + ":<br><textarea ng-model='evaluator.evaluator.settings." + property +
                      "'></textarea><button ng-click='set(\"" + property +
                      "\")'>set</button></div>")(scope));
            } else if (evaluator.spec[property].type === "action") {
              element.find('.bbody').append($compile("<div><button ng-click='evaluator.evaluator.perform(\"" + property +
                  "\")'>" + name + "</button></div>")(scope));
            }
          }
        }
      }
    };
  });
})();
