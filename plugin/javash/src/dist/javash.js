/*
 *  Copyright 2014 TWO SIGMA OPEN SOURCE, LLC
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
 * Java eval plugin
 * For creating and config evaluators that compile and/or evaluate Java code and update code cell results.
 */
define(function(require, exports, module) {
  'use strict';
  var PLUGIN_NAME = "Java";
  var COMMAND = "javash/javashPlugin";
  var serviceBase = null;
  var cometdUtil = bkHelper.getUpdateService();
  var JavaShCancelFunction = null;
  
  var JavaSh = {
    pluginName: PLUGIN_NAME,
    cmMode: "text/x-java",
    background: "#E0FFE0",
    bgColor: "#EB0000",
    fgColor: "#FFFFFF",
    borderColor: "",
    shortName: "Jv",
    newShell: function(shellId, cb) {
      if (!shellId)
        shellId = "";
      bkHelper.httpPost(bkHelper.serverUrl(serviceBase + "/rest/javash/getShell"), { shellId: shellId, sessionId: bkHelper.getSessionId() })
          .success(cb)
          .error(function() {
            console.log("failed to create shell", arguments);
          });
    },
    evaluate: function(code, modelOutput,refreshObj) {
      var deferred = Q.defer();
      
      if (JavaShCancelFunction) {
        deferred.reject("An evaluation is already in progress");
        return deferred.promise;
      }

      var self = this;
      bkHelper.setupProgressOutput(modelOutput);
      $.ajax({
        type: "POST",
        datatype: "json",
        url: bkHelper.serverUrl(serviceBase + "/rest/javash/evaluate"),
        data: {shellId: self.settings.shellID, code: code}
      }).done(function(ret) {
        JavaShCancelFunction = function () {
          $.ajax({
            type: "POST",
            datatype: "json",
            url: bkHelper.serverUrl(serviceBase + "/rest/javash/cancelExecution"),
            data: {shellId: self.settings.shellID}
          }).done(function (ret) {
            console.log("done cancelExecution",ret);
          });
          bkHelper.setupCancellingOutput(modelOutput);
        }
        var onEvalStatusUpdate = function(evaluation) {
          if (bkHelper.receiveEvaluationUpdate(modelOutput, evaluation, PLUGIN_NAME, self.settings.shellID)) {
            cometdUtil.unsubscribe(evaluation.update_id);
            JavaShCancelFunction = null;
            if (evaluation.status === "ERROR")
              deferred.reject(evaluation.payload);
            else
              deferred.resolve(evaluation.payload);
          }
          if (refreshObj !== undefined)
            refreshObj.outputRefreshed();
          else
            bkHelper.refreshRootScope();
        };
        onEvalStatusUpdate(ret);
        if (ret.update_id) {
          cometdUtil.subscribe(ret.update_id, onEvalStatusUpdate);
        }
      });
      return deferred.promise;
    },
    interrupt: function() {
      this.cancelExecution();
    },
    cancelExecution: function () {
      if (JavaShCancelFunction) {
        JavaShCancelFunction();
      }
    },
    resetEnvironment: function () {
      $.ajax({
        type: "POST",
        datatype: "json",
        url: bkHelper.serverUrl(serviceBase + "/rest/javash/resetEnvironment"),
        data: {shellId: this.settings.shellID}
      }).done(function (ret) {
        console.log("done resetEnvironment",ret);
      });
    },
    killAllThreads: function () {
      $.ajax({
        type: "POST",
        datatype: "json",
        url: bkHelper.serverUrl(serviceBase + "/rest/javash/killAllThreads"),
        data: {shellId: this.settings.shellID}
      }).done(function (ret) {
        console.log("done killAllThreads",ret);
      });
    },
    autocomplete: function(code, cpos, cb) {
      var self = this;
      $.ajax({
        type: "POST",
        datatype: "json",
        url: bkHelper.serverUrl(serviceBase + "/rest/javash/autocomplete"),
        data: {shellId: self.settings.shellID, code: code, caretPosition: cpos}
      }).done(function(x) {
        cb(x, undefined, true);
      });
    },
    exit: function(cb) {
      var self = this;
      this.cancelExecution();
      JavaShCancelFunction = null;
      $.ajax({
        type: "POST",
        datatype: "json",
        url: bkHelper.serverUrl(serviceBase + "/rest/javash/exit"),
        data: { shellId: self.settings.shellID }
      }).done(cb);
    },
    updateShell: function (cb) {
      var p = bkHelper.httpPost(bkHelper.serverUrl(serviceBase + "/rest/javash/setShellOptions"), {
        shellId: this.settings.shellID,
        classPath: this.settings.classPath,
        imports: this.settings.imports,
        outdir: this.settings.outdir});
      if (cb) {
        p.success(cb);
      }
    },
    spec: {
      outdir:      {type: "settableString", action: "updateShell", name: "Dynamic classes directory"},
      classPath:   {type: "settableString", action: "updateShell", name: "Class path (jar files, one per line)"},
      imports:     {type: "settableString", action: "updateShell", name: "Imports (classes, one per line)"},
      resetEnv:    {type: "action", action: "resetEnvironment", name: "Reset Environment" },
      killAllThr:  {type: "action", action: "killAllThreads", name: "Kill All Threads" }
    },
    cometdUtil: cometdUtil
  };
  var defaultImports = [
    "com.twosigma.beaker.chart.Color",
    "com.twosigma.beaker.BeakerProgressUpdate",
    "com.twosigma.beaker.chart.xychart.*",
    "com.twosigma.beaker.chart.xychart.plotitem.*",
    "com.twosigma.beaker.NamespaceClient"];
  var shellReadyDeferred = bkHelper.newDeferred();

  var init = function() {
    bkHelper.locatePluginService(PLUGIN_NAME, {
      command: COMMAND,
      waitfor: "Started SelectChannelConnector",
      recordOutput: "true"
    }).success(function(ret) {
      serviceBase = ret;
      bkHelper.spinUntilReady(bkHelper.serverUrl(serviceBase + "/rest/javash/ready")).then(function () {
        if (window.languageServiceBase == undefined) {
          window.languageServiceBase = {};
        }
        window.languageServiceBase[PLUGIN_NAME] = bkHelper.serverUrl(serviceBase + '/rest/javash');
        if (window.languageUpdateService == undefined) {
          window.languageUpdateService = {};
        }
        window.languageUpdateService[PLUGIN_NAME] = cometdUtil;
        cometdUtil.init(PLUGIN_NAME, serviceBase);

        var JavaShell = function(settings, doneCB) {
          var self = this;
          var setShellIdCB = function(id) {
            settings.shellID = id;
            self.settings = settings;
            var imports = [];
            if ("imports" in self.settings) {
              imports = self.settings.imports.split('\n');
            }
            self.settings.imports = _.union(imports, defaultImports).join('\n');
            var cb = function() {
              if (doneCB) {
                doneCB(self);
              }
            };
            self.updateShell(cb);
          };
          if (!settings.shellID) {
            settings.shellID = "";
          }
          this.newShell(settings.shellID, setShellIdCB);
          this.perform = function(what) {
            var action = this.spec[what].action;
            this[action]();
          };
        };
        JavaShell.prototype = JavaSh;
        shellReadyDeferred.resolve(JavaShell);
      }, function () {
        console.log("plugin service failed to become ready", PLUGIN_NAME, arguments);
        shellReadyDeferred.reject("plugin service failed to become ready");
      });
    }).error(function() {
      console.log("failed to locate plugin service", PLUGIN_NAME, arguments);
      shellReadyDeferred.reject("failed to locate plugin service");
    });
  };
  init();

  exports.getEvaluatorFactory = function() {
    return shellReadyDeferred.promise.then(function(Shell) {
      return {
        create: function(settings) {
          var deferred = bkHelper.newDeferred();
          new Shell(settings, function(shell) {
            deferred.resolve(shell);
          });
          return deferred.promise;
        }
      };
    },
    function(err) { return err; });
  };

  exports.name = PLUGIN_NAME;
});
