(function(window,document){(function (root) {

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function noop() {
  }

  // Use polyfill for setImmediate for performance gains
  var asap = (typeof setImmediate === 'function' && setImmediate) ||
    function (fn) {
      setTimeoutFunc(fn, 0);
    };

  var onUnhandledRejection = function onUnhandledRejection(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function () {
      fn.apply(thisArg, arguments);
    };
  }

  function Promise(fn) {
    if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._handled = false;
    this._value = undefined;
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    asap(function () {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      asap(function() {
        if (!self._handled) {
          onUnhandledRejection(self._value);
        }
      });
    }

    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        resolve(self, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function (onFulfilled, onRejected) {
    var prom = new (this.constructor)(noop);

    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.all = function (arr) {
    var args = Array.prototype.slice.call(arr);

    return new Promise(function (resolve, reject) {
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(val, function (val) {
                res(i, val);
              }, reject);
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function (value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function (resolve) {
      resolve(value);
    });
  };

  Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function (values) {
    return new Promise(function (resolve, reject) {
      for (var i = 0, len = values.length; i < len; i++) {
        values[i].then(resolve, reject);
      }
    });
  };

  /**
   * Set the immediate function to execute callbacks
   * @param fn {function} Function to execute
   * @private
   */
  Promise._setImmediateFn = function _setImmediateFn(fn) {
    asap = fn;
  };

  Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
    onUnhandledRejection = fn;
  };
  
  root.Promise = Promise;
 
})(this);

/**
 * @name Tetra
 * @version 1.11.1
 * @author Nicolas RAIBAUD
 * @author Luis NOVO
 * @description Tetra bridge library
 */

// todo methods in service should be in prototype (?)

"use strict";

var tetra, services, events, http, CONFIG, ENV, promise, websocket, websocketClient, connectionClient, websocketWAAS, connectionWAAS;

//trick to remove console.log in tetraJS
var c = console;
var wceCmd = function() { c.log.apply(c,arguments);}

/**
 * @name opts
 * @object
 * @description Defines the option parameters for the services
 */
CONFIG = {};

CONFIG.CFG_URL = '/pkg_config.json';
CONFIG.URL = 'http://terminal.ingenico.com';
CONFIG.SERVICE_URL = CONFIG.URL + '/service';
CONFIG.WAAS_URL = CONFIG.URL + '/waas';
CONFIG.WS_PROXY_URL = 'ws://ws.webos/proxy';
CONFIG.DESKTOP_WAID = '00000000';
CONFIG.WP_VERSION = null;
CONFIG.START_END = {
    DISABLED:{
        SHORT:"SHORT",
        DISABLED:"DISABLED"
    },
    METHODS:{
        SE_START: {
            id: 1
        },
        // Warning :: SE_CHECK_PREPARE should not be used in a webapp
        SE_CHECK_PREPARE: {
            id: 2
        },
        SE_END: {
            id: 3
        }
    }
};
CONFIG.CONNECT_EVENT = 'ingenico.webos.ServiceConnect';
CONFIG.DISCONNECT_EVENT = 'ingenico.webos.ServiceDisconnect';

ENV = {};
ENV.webletId = null;


/**
 * @name weиsocket
 * @function object
 * @description Defines the websocket unified communication object
 */
websocket = {
    //supported: unknown for the beginning

    //it is not possible to have nested this.doPromise() so in some cases (when init is called 
    //from websocket's methos) just callbacks are used
    init: function (success, error) {
        var that = this;

        var doInit = function(success, error) {
            if (that.supported !== undefined) {
                return success();
            }
            that.supported = true;
            that.ws = new WebSocket(CONFIG.WS_PROXY_URL);
            that.ws.onopen = function() {                
                return success();
            };
            that.ws.onerror = function (e) {
                that.supported = false;
                return error(e);
            };
            that.ws.onclose = function () {}; //??
            that.ws.onmessage = function (mess) { 
                var d = JSON.parse(mess.data);

                if (d.error !== undefined) {
                    var error = that.listeners[d.id.toString()].error;
                    delete that.listeners[d.id.toString()];
                    return error({
                        status: d.error,
                        msg: d.descr,
                        response: d.data
                    })                    
                }
                
                var success = that.listeners[d.id.toString()].success;
                delete that.listeners[d.id.toString()];
                return success(d.data);    
            };
        } 

        if (success === undefined || error === undefined) {
            var options = {then: 'both'};
            this.doPromise(options, function(onSuccess, onError) {
                doInit(onSuccess, onError);
            });
        } else {
            doInit(success, error);
        }

        return this;
    },
    check: function () {
        var options = {then: 'both'};
        var that = this;
        this.doPromise(options, function(onSuccess, onError) {
            that.init(function() {
                return onSuccess(that.supported);
            }, onError);
        });
        return this;
    },
    request: function(type, data) {
        var options = {then: 'both'};
        var that = this;
        this.doPromise(options, function(onSuccess, onError) {
            var id = that.id;
            that.id++;
            that.listeners[id.toString()] = {
                success: onSuccess,
                error: onError 
            };
            that.ws.send(JSON.stringify({
                type: type,
                id: id,
                data: data
            }));
        });
        return this;
    },
    id: 0,
    ws: null,
    listeners: [],
    handler: {
        resolve: null,
        reject: null,
        promise: null
    },
    doPromise: function (options, fn) {
        return tetra.doPromise.apply(this, [options, fn]);
    },
    then: function (onSuccess, onError) {
        return tetra.then.call(this, onSuccess, onError);
    },
    catch: function (error) {
        return tetra.then.call(this, null, error);
    },
    success: function (success) {
        return tetra.then.call(this, success, null);
    },
    error: function (error) {
        return tetra.then.call(this, null, error);
    },
    resolve: function (response) {
        return tetra.resolve.call(this, response, this.handler);
    },
    reject: function (reason) {
        return tetra.reject.call(this, reason, this.handler);
    }
};

/**
 * @name websocketWAAS
 * @function object
 * @description Defines the websocketWAAS helper functions to create the WAAS services
 */
websocketWAAS = {
    supported: false, 
    registered: false,
    interFaceMap: {},
    clients: null,
    clientsMap: {},
    EventsServiceMap :{},
    /***
     *
     * Configures WaaS
     *
     * @param interfaceName - (string) interface name
     * @param clientsRef - (object) ?? TODO: pit description here
     * @param nopts - (bool) no optional fields transfer mode
     */
    configureService: function(interfaceName, clientsRef, nopts) {
        this.clients = clientsRef;
        var configuration = {
            nm: "CFG",
            f: [],
            ps: [],
            to: 10000,
            no: nopts
        };
        //TODO: replace websocketWAAS by this

        /**Creating the config object from properties ***/
        for (var eventKey in websocketWAAS.interFaceMap[interfaceName].events) {
            if (typeof websocketWAAS.interFaceMap[interfaceName].events[eventKey] !== 'object')
                continue;
            var eventName =websocketWAAS.interFaceMap[interfaceName].events[eventKey].eventName;
            for (var format in websocketWAAS.interFaceMap[interfaceName].events[eventKey].properties.formats) {
                if (typeof websocketWAAS.interFaceMap[interfaceName].events[eventKey].properties.formats[format] !== 'string')
                    continue;
                var upperCaseEvent = eventName[0].toUpperCase() + eventName.slice(1);
                var formatConf = {
                    nm: interfaceName.replace(/\.\w+$/, '') + "." + upperCaseEvent + format,
                    f: websocketWAAS.interFaceMap[interfaceName].events[eventKey].properties.formats[format]
                };
                configuration.f.push(formatConf);
            }

            // Add perms parameters
            if (websocketWAAS.interFaceMap[interfaceName].events[eventKey].properties.perms &&
                typeof websocketWAAS.interFaceMap[interfaceName].events[eventKey].properties.perms === 'object' &&
                websocketWAAS.interFaceMap[interfaceName].events[eventKey].properties.perms instanceof Array) {
                var permissionConf = {
                    nm: interfaceName.replace(/\.\w+$/, '') + "." + upperCaseEvent + "Request",
                    v: websocketWAAS.interFaceMap[interfaceName].events[eventKey].properties.perms.toString()
                };
                configuration.ps.push(permissionConf);
            }
        }
        websocketWAAS.interFaceMap[interfaceName].CFG = configuration;
        websocketWAAS.send("CFG", interfaceName);
    },
    /***
     *
     * Add interface
     *
     * @param interfaceName - (string) interface name
     */
    addInterface: function(interfaceName) {
        this.interFaceMap[interfaceName] = this.interFaceMap[interfaceName] || {};
        this.interFaceMap[interfaceName] = {
            interfaceName: interfaceName,
            events: {},
            MsMap: {}
        }
    },
    /***
     *
     * Register an event
     *
     * @param interfaceName - (string) interface name
     * @param eventDetl - (object) event details
     */
    registerEvent: function(interfaceName, eventDetl) {
        eventDetl.properties.perms = eventDetl.properties.perms || {};
        eventDetl.properties.formats = eventDetl.properties.formats || [];

        if (eventDetl.eventName === CONFIG.CONNECT_EVENT || eventDetl.eventName === CONFIG.DISCONNECT_EVENT) {
            this.interFaceMap['COMMON'] = this.interFaceMap['COMMON'] || {};
            this.interFaceMap['COMMON'].events = this.interFaceMap['COMMON'].events || {};
            this.interFaceMap['COMMON'].events[eventDetl.eventName] = eventDetl;
        } else {
            var upperCaseEvent = interfaceName.replace(/\.\w+$/,'') + "." + eventDetl.eventName[0].toUpperCase() + eventDetl.eventName.slice(1) + "Request";
            websocketWAAS.EventsServiceMap[upperCaseEvent] = interfaceName;
            this.interFaceMap[interfaceName].events[upperCaseEvent] = eventDetl;
        }
    },
    /***
     *
     * Send an event
     *
     * @param interfaceName - (string) interface name
     * @param eventDetl - (object) event details
     */
    sendEvent: function(interfaceName, eventDetls) {
        var data = {
            nm: interfaceName.replace(/\.\w+$/,'')+"."+eventDetls.eventName,
            to: 5000,
        }; 
        try {
            if (eventDetls.data === undefined) {
                data.ms = {};
            } else {
                data.ms = typeof eventDetls.data === 'string' ? JSON.parse(eventDetls.data) : eventDetls.data;
            }
        } catch (e) {
            data.ms = {};
        }

        if(eventDetls.connectionId !== null && eventDetls.connectionId !== undefined){
            data.id=eventDetls.connectionId
        }
        websocketWAAS.send("EVT",interfaceName, data, eventDetls.callback, eventDetls.error);
    },
    /***
     *
     * Send response to the client
     *
     * @param msgName - (string) message name
     * @param conId - (int) connection ID
     * @param data - (obj or string) data to send
     * @param callback - (function) success callback
     * @param error - (function) error callbacl
     * @param timeout - (int) timeout in ms
     */
    sendResponse: function(msgName, conId, data, callback, error, timeout) {
        timeout = timeout || 5000;
        var msg = {
            nm: msgName,
            to: timeout,
            id: conId
        };
        try {
            if (data === undefined) {
                data = {};
            } else {
                msg.ms = typeof data === 'string' ? JSON.parse(data) : data;
            }
        } catch (e) {
            msg.ms = {};
        }
        websocketWAAS.send("RES",msgName, msg, callback, error);
    },
    /***
     *
     * Send data via Web Socket
     *
     * @param msgType - (string) message type 
     * @param interfaceName - (string) interface name
     * @param sendMSDetls - (object) options
     * @param callback - (function) success callback
     * @param error - (function) error callbacl
     */
    send: function(msgType, interfaceNm, sendMSDetls, callback, error) {
        if(connectionWAAS === undefined) {
            connectionWAAS =  new WebSocket('ws://ws.webos/waas');
            connectionWAAS.msgToSend = msgType;
        } else {
            handleSend(msgType); 
        } 
        
        connectionWAAS.onopen = function() {
            if(connectionWAAS.msgToSend !== "undefined")
            {
                handleSend(connectionWAAS.msgToSend);
                connectionWAAS.msgToSend = "undefined";
            }
        }
        
        function handleSend(msgType) { 
            try {
                switch (msgType) {
                case 'CFG': 
                    var cfg = websocketWAAS.interFaceMap[interfaceNm]["CFG"];
                    connectionWAAS.send(JSON.stringify(cfg));
                    //register websocket
                    var reg = {
                        nm:"REG",
                        no: cfg.no
                    };
                    if(!websocketWAAS.registered) {
                        connectionWAAS.send(JSON.stringify(reg));
                        websocketWAAS.registered=true;
                    }
                    break; 
                case 'EVT':
                    //test that websocket is ready in case of user what to send an event before any connection...
                    if(connectionWAAS.readyState == 1)
                        connectionWAAS.send(JSON.stringify(sendMSDetls));
                    break;
                case 'RES':
                    connectionWAAS.send(JSON.stringify(sendMSDetls));
                    break;  
                default:
                    throw 'Wrong websocketWAAS::send::handleSend msgType';
                }
                if (typeof callback === 'function') {
                    callback();
                }
            }
            catch (e) {
                if (typeof error === 'function') {
                    error(e);
                }
            }
        }

        connectionWAAS.onmessage = function(res) {
            var resData = JSON.parse(res.data);
            switch(true) {
            case "LU" === resData.nm:
                //serviceClass = r.s[0].cl;
                break;

            case "CON"=== resData.nm:
                websocketWAAS.clients.push(resData.id);
                websocketWAAS.clientsMap[resData.id] = {}; //TODO: AZ. ? Potentially we override data here
                try {
                    websocketWAAS.interFaceMap['COMMON'].events[CONFIG.CONNECT_EVENT].callBack({data: '{"id": "'+ resData.id + '"}'});
                } catch(e) {
                    //connect hedler is not defined - ignore this exception
                }
                break;

            case "DIS" === resData.nm:
                websocketWAAS.clients.splice(websocketWAAS.clients.indexOf(resData.id), 1);
                delete websocketWAAS.clientsMap[resData.id];
                try {
                    websocketWAAS.interFaceMap['COMMON'].events[CONFIG.DISCONNECT_EVENT].callBack({data: '{"id": "'+ resData.id + '"}'});
                } catch(e) {
                    //connect hedler is not defined - ignore this exception
                }
                break;

            case "ERR" === resData.nm:
                console.log('Error: ' , res);
                break;
            case resData.nm in websocketWAAS.EventsServiceMap:
                var interfaceNmExtract = websocketWAAS.EventsServiceMap[resData.nm];

                //Logic to handle sendResponse method.
                var Send = function (msgName, conId) {
                        this.msgName = msgName.slice(0,-7) + "Response";
                        this.connectionId = conId;
                        this.sendResponse = function (data ,opts, callback, error, timeout, expect) {
                            if(typeof opts === 'function') {
                                expect = arguments[4];
                                timeout = arguments[3];
                                error = arguments[2]; 
                                callback = arguments[1]; 
                            }
                            
                            websocketWAAS.sendResponse(this.msgName, this.connectionId, data, callback, error, timeout);
                            return this;
                        };
                };
                var send = new Send(resData.nm, resData.id);
                websocketWAAS.interFaceMap[interfaceNmExtract].events[resData.nm].callBack.call(send, {data: JSON.stringify(resData.ms)});
                break;
            }
        }
    }
};

/**
 * @name websocketClient
 * @function object
 * @description Defines the websocketClient helper functions to use by the services
 */
websocketClient = {
    supported: false,
    connectionMap: {},
    commonMap: {},
    //TODO: replace websocketClient by this
    /***
     *
     * Lookup interface
     *
     * @param interfaceName - (string) interface name
     * @param callback - (function) success callback
     * @param error - (function) error callback
     * @param timeout - (int) timeout ms
     */
    lookup: function(interfaceName, callback, error, timeout) {
        websocketClient.commonMap[interfaceName] = {
            interfaceName: interfaceName,
            callback: callback,
            error: error,
            timeout: timeout
        }
        this.send("LU",interfaceName);
    },
    /***
     *
     * Connect to the service
     *
     * @param name - (string) service name
     * @param formats - (string[]) formats
     * @param sendMSDetls - (object) options
     * @param callback - (function) success callback
     * @param error - (function) error callbacl
     * @param timeout - (int) timeout (ms)
     * @param nopts - (bool) no optional fields tranfer mode
     */
    connect: function(name, formats, callback, error, timeout, nopts) {
        websocketClient.commonMap[name] = {
            registeredEvents: {},
            serviceName: name,
            formats: formats,
            callback: callback,
            error: error,
            timeout: timeout,
            nopts: nopts
        }
        this.send("CON", name);
    }, 
    /***
     *
     * Call the service
     *
     * @param config - (obj) call configuration
     * @param callback - (function) success callback
     * @param error - (function) error callbacl
     * @param timeout - (int) timeout (ms)
     * @param expect - (function) expected result (for automatic tests)
     */
    call: function(config, callback, error, timeout, expect) {
        var webSocketRefId = config.id;
        var callMethod = config.nm;
        websocketClient.commonMap[webSocketRefId] = websocketClient.commonMap[webSocketRefId] || {};
        websocketClient.commonMap[webSocketRefId][callMethod] = {
            config: config,
            callback: callback,
            error: error,
            timeout: timeout,
            expect: expect
        }
        this.send("CALL", webSocketRefId, callMethod)
    },
    /***
     *
     * Disconnect from the service
     *
     * @param id - (int) call ID
     * @param callback - (function) success callback
     * @param error - (function) error callbacl
     * @param timeout - (int) timeout (ms)
     */
    disconnect: function(id, callback, error, timeout) {
        websocketClient.commonMap[id] = websocketClient.commonMap[id] || {};
        websocketClient.commonMap[id].disconnect = {
            id: id,
            callback: callback,
            error: error,
            timeout: timeout
        }
        this.send("DIS", id);
        delete websocketClient.commonMap[id];
    },
    /***
     *
     * Send data via websocket
     *
     * @param msgType - (string) message type
     * @param webSocketRefId - (string) configuration index
     * @param callMethod - (string) call name
     */
    send: function(msgType, webSocketRefId, callMethod) {
        if(connectionClient === undefined) {
            connectionClient =  new WebSocket('ws://ws.webos/service');
        } else {
            handleSend();
        }
        function handleSend() {
            switch (msgType){
            case "LU":
                var data = {
                    nm: "LU",
                    i: websocketClient.commonMap[webSocketRefId].interfaceName
                }
                if (websocketClient.commonMap[webSocketRefId].timeout) {
                    data.to = websocketClient.commonMap[webSocketRefId].timeout;
                }
                connectionClient.send(JSON.stringify(data));
                return;
            case "CON":
                var cfgData = {
                    nm: "CFG",
                    f: websocketClient.commonMap[webSocketRefId].formats,
                    to:5000
                }
                if (websocketClient.commonMap[webSocketRefId].timeout) {
                    cfgData.to = websocketClient.commonMap[webSocketRefId].timeout;
                }
                connectionClient.send(JSON.stringify(cfgData));
                var data = {
                    nm: "CON",
                    s: websocketClient.commonMap[webSocketRefId].serviceName,
                    no: websocketClient.commonMap[webSocketRefId].nopts
                }
                if (websocketClient.commonMap[webSocketRefId].timeout) {
                    data.to = websocketClient.commonMap[webSocketRefId].timeout;
                }
                connectionClient.send(JSON.stringify(data));
                break;
            case "CALL":
                var data = websocketClient.commonMap[webSocketRefId][callMethod].config;
                if (websocketClient.commonMap[webSocketRefId][callMethod].timeout) {
                    data.to = websocketClient.commonMap[webSocketRefId][callMethod].timeout;
                }
                connectionClient.send(JSON.stringify(data));
                break;
            case "DIS":
                var data = {
                    nm: "DIS",
                    id: webSocketRefId
                }
                connectionClient.send(JSON.stringify(data));
                websocketClient.commonMap[webSocketRefId].disconnect.callback(null);
                delete websocketClient.commonMap[webSocketRefId];
                break;  
            }
        }
          
        connectionClient.onopen = function() {
            handleSend();
        }
          
        connectionClient.onmessage = function(res) {
            var response = JSON.parse(res.data); 
            switch (true) {
            case "LU"==response.nm:
                var result = {
                    services: []
                } 
                for(var i=0; i< response.s.length; i++) {
                    result.services.push({
                        id: response.s[i].cl,
                        descr: response.s[i].d
                    });
                }
                websocketClient.commonMap[response.i].callback(result);
                delete websocketClient.commonMap[response.i];
                break;
                
            case "CON"==response.nm:
                var result = {
                    conn_id:response.id
                }
                websocketClient.commonMap[response.s].conn_id = response.id;
                websocketClient.commonMap[response.id] = websocketClient.commonMap[response.id] || {};
                websocketClient.commonMap[response.s].callback(result);
                delete websocketClient.commonMap[response.s];
                break;

            case response.nm.indexOf("Response") >= 0 :
                var result = {
                    conn_id:response.id
                }
                var requestName = response.nm.replace("Response", "Request");
                for(var key in response.ms) {
                    result[key]=response.ms[key];
                }
                if (result.return && result.return < 0) {
                    websocketClient.commonMap[response.id][requestName].error({response: result});
                    delete websocketClient.commonMap[response.id][requestName];
                    return;
                }
                if (typeof websocketClient.commonMap[response.id][requestName].expect === 'function') {
                    // Expect test successfull
                    if (websocketClient.commonMap[response.id][requestName].expect(result)) {
                        websocketClient.commonMap[response.id][requestName].callback(result);
                    } else { // Expect Failed
                        websocketClient.commonMap[response.id][requestName].error({ response: result});
                    }
                    delete websocketClient.commonMap[response.id][requestName];
                    return;
                }
                websocketClient.commonMap[response.id][requestName].callback(result);
                delete websocketClient.commonMap[response.id][requestName];
                break;

            case response.nm.indexOf("Event") >= 0:
                var result = {
                    conn_id:response.id
                }
                if(websocketClient.commonMap[response.id].registeredEvents[response.nm]) {
                    websocketClient.commonMap[response.id].registeredEvents[response.nm].callback.call(websocketClient.commonMap[response.id].registeredEvents[response.nm].context, response.ms)
                } 
                break;
            
            case "ERR"==response.nm:
                function onError() {
                    websocketClient.commonMap[webSocketRefId].error && websocketClient.commonMap[webSocketRefId].error({
                        msg: response.desc,
                        status: "",
                        response: response
                    });
                }
                    
                if (response.rs) {
                    var result = {
                        conn_id: response.id,
                        msg: http.statusCodes[response.st],
                        status: response.st,
                        response: response.d
                    }
                    var requestName = response.rs.replace("Response", "Request");
                    if (typeof websocketClient.commonMap[response.id][requestName].expect === 'function') {
                        // Expect test successfull
                        if (websocketClient.commonMap[response.id][requestName].expect(result)) {
                            websocketClient.commonMap[response.id][requestName].callback(result);
                        } else { // Expect Failed
                            websocketClient.commonMap[response.id][requestName].error(response);
                        }
                        delete websocketClient.commonMap[response.id][requestName];
                        break;
                    }
                    websocketClient.commonMap[response.id][requestName].error(result);
                    delete websocketClient.commonMap[response.id][requestName];
                    break;
                };

                onError();
                break;              
            }
        }
    },
    /***
     *
     * Register an event
     *
     * @param conn_id - (int) connection ID
     * @param name - (string) event name
     * @param callback - (function) event tretment callback
     * @param context - (object) event context
     */
    registerEvent: function(conn_id, name, callback, context) {
        websocketClient.commonMap[conn_id].registeredEvents =
            websocketClient.commonMap[conn_id].registeredEvents || {}
        websocketClient.commonMap[conn_id].registeredEvents[name] = {
            callback:callback,
            context:context
        }
    }
};


/**
 * @name http
 * @function object
 * @description Defines the http helper functions to use by the services
 */
http = {
    // Parses the data to send to a post request
    parse: function (data) {
        var d, buffer = [];

        // adds each property
        for (d in data) {
            if (data.hasOwnProperty(d)) {
                buffer.push(d + '=' + data[d]);
            }
        }

        // returns the value
        return encodeURI(buffer.join('&'));
    },

    // datatype - request/response data type: "json" (default), "text", "arraybuffer" or "blob"
    ajax: function (method, url, data, callback, error, timeout, async, expect, datatype) {

        datatype = datatype || "json";

        // Creates the request and opens it
        var xmlreq = new XMLHttpRequest();
        xmlreq.open(method, url, async);
        //AZ. Here we don't use the sentence 'xmlreq.responseType = datatype' 
        //    just to be sure that we keep backward compatibility
        if (datatype == 'arraybuffer') {
            xmlreq.responseType = 'arraybuffer';
        }

        // If the request is a post it parses the data if it exists
        if (method === 'POST' || method === 'PUT') {
            //AZ. introduction of datatype parameter
            // before: data = data && (typeof data === 'string' ? data : JSON.stringify(data));
            data = data && ((datatype == 'json' && typeof data !== 'string') ? JSON.stringify(data) : data);
            //data = data.replace(/\\\\/g, "\\");
        }

        // Sets the callback
        xmlreq.onreadystatechange = function () {

            var response;

            function onError() {
                error && error({
                    msg: xmlreq.statusText || ('XMLHttpRequest error status ' + xmlreq.status),
                    status: xmlreq.status,
                    response: response
                });
            }

            function onSuccess() {
                callback && callback(response);
            }

            // When the request is completed, clears the listener and returns the callback
            if (xmlreq.readyState === 4) {
                xmlreq.onreadystatechange = null;

                // if the request was sucessfull, returns the response
                if (xmlreq.status === 200 || xmlreq.status === 204) {

                    //AZ. introduction of datatype parameter
                    if (datatype != 'json') {
                        response = xmlreq ? xmlreq.response : null;
                    } else {
                        response = xmlreq && xmlreq.responseText ? JSON.parse(xmlreq.responseText) : null; //code before 'datatype' introduction
                    }

                    if (expect && typeof expect === 'function') {
                        // Expect test successfull
                        if (expect(response)) {
                            onSuccess();
                        } else { // Expect Failed
                            onError();
                        }
                        return;
                    }

                    // Has error in return
                    if (response && response.return) {
                        onError();
                    }
                    else { // We expect nothing
                        onSuccess();
                    }
                }

                // if not, returns an error
                else {
                    try {
                        response = xmlreq && xmlreq.responseText ? JSON.parse(xmlreq.responseText) : null;
                    } catch (e) {
                        response = xmlreq && xmlreq.responseText ? xmlreq.responseText : null;
                    }
                    onError();
                }
            }
        };

        // it sets the timeout if passed
        if (timeout) {
            xmlreq.timeout = timeout;
        }

        xmlreq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

        // Sends the data
        xmlreq.send(data);
    },

    // Override for the post method
    post: function (url, data, callback, error, timeout, expect) {
        this.ajax('POST', url, data, callback, error, timeout, true, expect);
    },

    // Override for the get method
    get: function (url, callback, error, timeout, datatype) {
        this.ajax('GET', url, null, callback, error, timeout, true, undefined, datatype);
    },

    // Override for the delete method
    del: function (url, data, callback, error, timeout, async) {
        this.ajax('DELETE', url, data, callback, error, timeout, async);
    },

    // Override for the put method
    put: function (url, data, callback, error, timeout, datatype) {
        this.ajax('PUT', url, data, callback, error, timeout, true, undefined, datatype);
    },
      
    statusCodes: {
        200: 'OK',
        201: 'Created',
        202: 'Accepted',
        203: 'Non-Authoritative Information',
        204: 'No Content',
        205: 'Reset Content',
        206: 'Partial Content',
        300: 'Multiple Choices',
        301: 'Moved Permanently',
        302: 'Found',
        303: 'See Other',
        304: 'Not Modified',
        305: 'Use Proxy',
        307: 'Temporary Redirect',
        400: 'Bad Request',
        401: 'Unauthorized',
        402: 'Payment Required',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        406: 'Not Acceptable',
        407: 'Proxy Authentication Required',
        408: 'Request Timeout',
        409: 'Conflict',
        410: 'Gone',
        411: 'Length Required',
        412: 'Precondition Failed',
        413: 'Request Entity Too Large',
        414: 'Request-URI Too Long',
        415: 'Unsupported Media Type',
        416: 'Requested Range Not Satisfiable',
        417: 'Expectation Failed',
        500: 'Internal Server Error',
        501: 'Not Implemented',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout',
        505: 'HTTP Version Not Supported'
    }      
};

services = [], // Private Services instances
events = {}, // Private events,
promise = null; // Tetra promises

/***
 *
 * Get the timeout value
 *
 * @param timeout
 * @returns {*|timeout|Number|XMLHttpRequest.timeout}
 */
function getTimeout(timeout) {
    return timeout || this.timeout || this.requestTimeout;
}

/***
 *
 * Get the delay value
 *
 * @param delay
 * @returns {*|number}
 */
function getDelay(delay) {
    return delay || this.delay || this.requestDelay;
}

/***
 *
 * Get the delay value
 *
 * @param delay
 * @returns {*|number}
 */
function getThen(then) {
    return then || this.then;
}

/***
 *
 * Define a service
 *
 * @param serviceName
 * @param options
 * @returns {{evtSource: window.EventSource, delay: (*|number), timeout: (*|timeout|Number|XMLHttpRequest.timeout), call: call, connect: connect, disconnect: disconnect, then: then, catch: catch, success: success, error: error, trigger: trigger, on: on, off: off, resolve: resolve, reject: reject, destroy: destroy}}
 * @constructor
 */
var Service = function (options) {
    var me, sse, serviceName, namespace, formats, hidden;

    options = options || {},
    sse = {},
    hidden = false,
    serviceName = options.service,
    namespace = options.namespace,
    formats = options.formats;

    return me = {
        conn_id: '',
        serviceName: serviceName,
        connected: false,
        defaults: null,
        promise: null,
        evtSource: null,
        handler: {
            resolve: null,
            reject: null,
            promise: null
        },
        requestDelay: options.requestDelay || tetra.requestDelay,
        requestTimeout: options.requestTimeout || tetra.requestTimeout,
        /***
         *
         * Connect to service
         *
         * @param options
         * @returns {me}
         */
        connect: function (options) {
            options = options || {};

            // Call by default on reject
            options.then = options.then || 'both';

            // Creates a promise
            this.doPromise(options, function (onSuccess, onError, timeout) {
                if (!me.connected) {
                    var onSuccessWrapper = function (response) {
                        me.connected = true;

                        // Set the connection id if present
                        if(response && response.conn_id !== -1) {
                            me.conn_id = response.conn_id
                        }
                        if(response && response.d !== undefined) {
                            me.defaults = response.d;
                        }
                        return onSuccess(response);
                    };
                    var formatsParameters = '';
                    var formatsParametersWebSocket=new Array();
                    var prefix = (namespace === undefined) ? '' : namespace + '.';
                    if(websocketClient.supported) {
                        for (var msgName in formats) {
                            formatsParametersWebSocket.push({
                                nm: prefix + msgName ,
                                f:formats[msgName]
                            });
                        }
                    } else {
                        // Pass formats
                        for (var format in formats) {
                            formatsParameters += 'format_' + prefix + format + '=' + formats[format] + '&';
                        }
                    }
                    if(websocketClient.supported) {
                        return websocketClient.connect(serviceName, formatsParametersWebSocket, onSuccessWrapper, onError, timeout, options.nopts === true);
                    }else{
                        var nopts = options.nopts ? "nopts&" : "";
                        return http.get(CONFIG.SERVICE_URL + '/' + serviceName + '?multi&' + nopts + formatsParameters, onSuccessWrapper, onError, timeout);
                    }
                } else {
                    console.info('Already connected');
                    return onSuccess();
                }
            });

            return this;
        },
        /***
         *
         * Disconnect from service
         *
         * @param options
         * @returns {me}
         */
        disconnect: function (options) {

            options = options || {};

            // Call by default on both
            options.then = options.then || 'both';

            // Creates promise
            this.doPromise(options, function (onSuccess, onError, timeout) {
                if (me.connected) {
                    var onSuccessWrapper = function (response) {
                        me.connected = false;
                        if (me.evtSource) {
                        me.off();
                        me.evtSource.close();
                        me.evtSource = null;
                        }
                        return onSuccess(response);
                    };
                    
                    if(websocketClient.supported) {
                        return  websocketClient.disconnect(me.conn_id, onSuccessWrapper, onError, timeout);
                    }else{
                        return http.del(CONFIG.SERVICE_URL + '/' + serviceName + '?conn_id=' + me.conn_id, {}, onSuccessWrapper, onError, timeout, options.async === false ? false : true);
                    }
                } else {
                    console.info('Not connected');
                    return onSuccess();
                }
            });

            return this;
        },
        /***
         *
         * Call a a service method
         *
         * @param methodName
         * @param options
         * @returns {me}
         */
        call: function (methodName, options) { // all options can be override here for this method

            options = options || {};

            // Call by default on resolved
            options.then = options.then || 'resolved';

            // Add a promise only if we are connected

            // Creates promise
            this.doPromise(options, function (onSuccess, onError, timeout) {
                if (me.connected) {
                    // Creates the request params
                    var req = (namespace ? namespace + '.' : '') + methodName + 'Request',
                        res = (namespace ? namespace + '.' : '') + methodName + 'Response',
                        data = options.data || {};

                    // todo implement new RPC version
//   http://terminal.ingenico.com/service/local.device.chip0/ingenico.device.chip.ManageTransaction ?
// >>> http://terminal.ingenico.com/service/local.device.chip0/ingenico.device.chip.Chip/start

                    if (options.hide) {
                        hidden = true;
                        //  tetra.hide();
                    }

                    var onSuccessWrapper = function (response) {
                        if (hidden) {
                            hidden = false;
                            tetra.show();
                        }
                        return onSuccess(response);
                    };

                    var onErrorWrapper = function (response) {
                        if (hidden) {
                            hidden = false;
                            tetra.show();
                        }
                        return onError(response);
                    };
                    
                    // Call the service method 
                    if(websocketClient.supported) {
                        var conf = {
                            nm:req,
                            id:me.conn_id,
                            ms: data
                        } 
                        return websocketClient.call(conf, onSuccessWrapper, onErrorWrapper, timeout, options.expect);
                    }else{
                        // Call the service method
                        return http.post(CONFIG.SERVICE_URL + '/' + serviceName + '?request=' + req + '&response=' + res + '&conn_id=' + me.conn_id, data, onSuccessWrapper, onErrorWrapper, timeout, options.expect);
                    }
                } else {
                    return onError({msg: 'Not connected call'});
                }
            });

            return this;
        },
        /***
         *
         * Get default values of the optional fields
         *
         * @param name - (string) - message name
         * @returns {me}
         */
        defval: function (name) {
            var defs = {};
            if (me.defaults != null) {
                if (name === undefined) {
                    defs = me.defaults;
                } else {
                    for (var k in me.defaults) {
                        if (me.defaults[k].name === namespace + '.' + name) {
                            defs = me.defaults[k].defaults;
                            break;
                        }
                    }
                }
            }
            return defs;
        },
        doPromise: function (options, fn) {
            return tetra.doPromise.apply(this, [options, fn]);
        },
        reset: function () {
            return tetra.reset.call(this);
        },
        then: function (onSuccess, onError) {
            return tetra.then.call(this, onSuccess, onError);
        },
        catch: function (error) {
            return tetra.then.call(this, null, error);
        },
        success: function (success) {
            return tetra.then.call(this, success, null);
        },
        error: function (error) {
            return tetra.then.call(this, null, error);
        },
        resolve: function (response) {
            return tetra.resolve.call(this, response, me.handler);
        },
        reject: function (reason) {
            return tetra.reject.call(this, reason, me.handler);
        },
        /***
         *
         * Add service envent, sse event
         *
         * @param eventName
         * @param callback
         * @param context
         * @returns {me}
         */
        on: function (eventName, callback, context) {

            if (eventName && !eventName.match(/\./) && eventName !== 'message') {
                eventName = (namespace ? namespace + '.' : '') + eventName;
            }

            options = options || {};

            // Call by default on resolved
            options.then = options.then || 'resolved';

            // Creates promise
            this.doPromise(options, function (onSuccess, onError, timeout) {

                if(websocketClient.supported) {
                    if (!me.connected) {
                        return onError();   
                    } else {
                        context = context || me;
                        websocketClient.registerEvent(me.conn_id, eventName, callback, context);
                        return onSuccess();
                    }
                } else {
                    if (!me.evtSource) {
                        return onError();
                    }

                    context = context || me;

                    sse[eventName] = {
                        eventName: eventName,
                        callback: callback,
                        context: context
                    };

                    // Add SSE event to SSE object
                    // me.evtSource.addEventListener(eventName, sse[eventName].callback.bind(context), false);
                    me.evtSource.addEventListener(eventName, function (response) {
                        var data = JSON.parse(response.data);
                        if (sse[eventName]) {
                            sse[eventName].callback.call(context, data);
                        }
                    }, false);
                    return onSuccess(); 
                }
                
            });

            return this;
        },
        /***
         *
         * Open sse
         *
         */
        open: function (options) {

            options = options || {};

            // Call by default on resolved
            options.then = options.then || 'resolved';

            // Creates promise
            this.doPromise(options, function (onSuccess, onError, timeout) {
                if(websocketClient.supported) {
                    if (me.connected){
                        return onSuccess();
                    } else {
                        return onError({msg: 'Not connected'});
                    }
                } else {
                    if (me.connected && !me.evtSource) {
                        me.evtSource = new window.EventSource(CONFIG.SERVICE_URL + '/' + serviceName + '/sse?conn_id=' + me.conn_id);
                        me.evtSource.onerror = function (e) {
                            return onError(e);
                        };
                        me.evtSource.onopen = function (e) {
                            return onSuccess(e);
                        };
                        return onSuccess();
                    }
                    else {
                        // Event is already opened. Ignore it
                        return onSuccess();
                    }
                }
            });
            return this;
        },
        /***
         *
         * Close sse
         *
         */
        close: function (options) {
            options = options || {};

            // Call by default on resolved
            options.then = options.then || 'resolved';

            if (!me.evtSource) {
                return this;
            }

            // Creates promise
            this.doPromise(options, function (onSuccess, onError, timeout) {
                if (me.evtSource) {
                    me.off();
                    return onSuccess();
                } else {
                    return onError({'msg': 'Event source not exist'});
                }
            });

            return this;
        },
        /***
         *
         * Remove service event, sse event
         *
         * @param eventName
         * @returns {me}
         */
        off: function (eventName, handler, context) {

            if (eventName && !eventName.match(/\./) && eventName !== 'message') {
                eventName = (namespace ? namespace + '.' : '') + eventName;
            }

            if (!me.evtSource) {
                return this;
            }

            function remove(eventName) {

                // Remove event
                me.evtSource.removeEventListener(eventName, handler || sse[eventName].callback, false);

                // Delete object
                delete sse[eventName];
            }

            if (!eventName) { // Remove all events
                for (var evt in sse) {
                    var evtName;

                    evtName = sse[evt].eventName;

                    // Remove event
                    remove(evtName);
                }
            }
            else if (typeof eventName === 'string') { // Remove string event
                remove(eventName);
            } else if (typeof eventName === 'object' && eventName instanceof Array) { // Remove array of events
                for (var i = 0, len = eventName.length; i < len; i++) {
                    var evtName;

                    evtName = eventName[i];

                    // Remove event
                    remove(evtName);
                }
            } else {

                for (var evt in sse) { // Remove regex
                    var evtName;

                    evtName = sse[evt].eventName;

                    if (evtName.match(eventName)) {
                        // Remove event
                        remove(evtName);
                    }
                }
            }

            return this;
        },
        /***
         *
         * Destroy the service
         *
         */
        destroy: function () {
            var service;

            this.disconnect()
            .close({success: this.reset});

            service = services.indexOf(this);
            services.splice(service, 1);
        }
    };
};

tetra = {
    version: '1.11.1',
    requestDelay: 0, //  Delay between requests
    requestTimeout: 0,  // ajax timeout request
    handler: {
        resolve: null,
        reject: null,
        promise: null
    },
    exports: { //export local objects to be accessible from optional components (tetra.file, tetra.tsu, etc)
        http: http,
        websocket: websocket
    },
    setup: function (properties, callback) {

        var serviceUrl = "http://terminal.ingenico.com/setup";

        function agregate(response) {
            // Agregate properties with Tetra properties
            response.requestDelay = tetra.requestDelay;
            response.requestTimeout = tetra.requestTimeout;
        }

        // Deprecated since 1.1.0
        if (callback && typeof callback === "function") {

            console.warn("Deprecated since 1.1.0");

            var options;

            if (typeof properties === 'function') {
                http.get(serviceUrl, function (response) {
                    agregate(response);
                    return properties(response);
                });

            } else if (typeof properties === 'object') {

                options = JSON.parse(JSON.stringify(properties));

                // Setup Tetra properties;
                tetra.requestDelay = options.requestDelay || tetra.requestDelay;
                tetra.requestTimeout = options.requestTimeout || tetra.requestTimeout;

                delete options.requestDelay;
                delete options.requestTimeout;

                http.post(serviceUrl, options, callback);
            }

        } else {

            properties = properties || {};

            // Call by default on both
            properties.then = properties.then || 'both';

            if (properties && properties.data) {

                var data = JSON.parse(JSON.stringify(properties.data));

                // Setup Tetra properties;
                tetra.requestDelay = properties.data.requestDelay || tetra.requestDelay;
                tetra.requestTimeout = properties.data.requestTimeout || tetra.requestTimeout;

                delete data.requestDelay;
                delete data.requestTimeout;

                // Creates a promise
                this.doPromise(properties, function (onSuccess, onError, timeout) {
                    // Connect to service
                    return http.post(serviceUrl, data, onSuccess, onError, timeout);
                });
            } else {
                // Creates a promise
                this.doPromise(properties, function (onSuccess, onError, timeout) {
                    // Connect to service
                    return http.get(serviceUrl, onSuccess, onError, timeout);
                });
            }
        }

        return this;
    },
    setWSChannel: function(callback) {
        var loop = function(onSuccess, onError, timeout) {
            if(CONFIG.WP_VERSION != null) {
                if (CONFIG.WP_VERSION >= 2.10)  {
                    websocketClient.supported = true;
                    websocketWAAS.supported = true;
                }

                if (CONFIG.WP_VERSION >= 2.11) {
                    websocket.init()
                    .success(function() {
                        return onSuccess();
                    })
                    .error(onError);
                    return;
                }
                websocket.supported = false;

                return onSuccess();
            }
            if(timeout > 50) {
                timeout = timeout - 50;
                setTimeout(
                    loop, 50, onSuccess, onError, timeout);
            }
            else {
                return onError();
            }
        }
        // Creates a promise
        this.doPromise({}, function (onSuccess, onError, timeout) {
            timeout = timeout || 5000;
            loop(onSuccess, onError, timeout);
        });
        return this;
    },
    /***
     *
     * Creates a new Service instance
     *
     * @param serviceName
     * @param options
     * @returns {Service}
     */
    service: function (options) {

        var service;

        // Trow an error if we does not have serviceName
        if (!options.service) {
            return new Error('.service property is missing');
        }

        // Creates a new service
        service = new Service(options);

        // Register the new service as private
        services.push(service);

        return service;
    },
    /**
     * Disconnect all services
     * */
    disconnect: function () {

        for (var i = 0, len = services.length; i < len; i++) {
            var service;

            service = services[i];

            // Disconnect service
            if (service.connected) {

                http.del(CONFIG.SERVICE_URL + '/' + service.serviceName, {},
                    function () {
                    }
                    , function () {
                    },
                    service.requestTimeout, false);
            }

        }
        return this;
    },
    /**
     * Destroy all services
     * */
    destroy: function () {
        for (var i = 0, len = services.length; i < len; i++) {
            var service;

            service = services[i];

            // Destroy service
            service.destroy();
        }
        return this;
    },
    /**
     * Creates a lookup call for a specific interface
     * */
    /* interface lookup: namespace + interfaceName (Services)
    Namespace: ingenico.device.buzzer
    Service: Buzzer
    interfaceName: => Namespace + '.' + Service => ingenico.device.buzzer.Buzzer
    */
    lookup: function (interfaceName, callback) {

        // Deprecated since 1.1.0
        if (callback && typeof callback === "function") {

            console.warn("Deprecated since 1.1.0");

            interfaceName && http.get(CONFIG.SERVICE_URL + "?interface=" + interfaceName, callback);
        } else {
            var options = callback || {};

            // Call by default on both
            options.then = options.then || 'both';
            
            // Creates a promise
            this.doPromise(options, function (onSuccess, onError, timeout) {
                // Connect to service
                if(websocketClient.supported) {
                    return  websocketClient.lookup(interfaceName, onSuccess, onError, timeout);
                }else{
                    return http.get(CONFIG.SERVICE_URL + "?interface=" + interfaceName, onSuccess, onError, timeout);
                }
            });
        }
        return this;
    },
    hide: function () { // Hide layer
        wceCmd("INGENICO:WCE:hide");
    },
    show: function () { // Show layer
        wceCmd("INGENICO:WCE:show");
    },
    hideWP: function () { // Hide layer
        wceCmd("INGENICO:WCE:hideWP");
    },
    showWP: function () { // Show layer
        wceCmd("INGENICO:WCE:showWP");
    },
    weblet: {
        promise: null,
        handler: {
            resolve: null,
            reject: null,
            promise: null
        },
        hide: function () { // Hide weblet
            wceCmd("INGENICO:WEBLET:hide");

            return this;
        },
        show: function () { // Show weblet
            wceCmd("INGENICO:WEBLET:show");

            return this;
        },
        notify: function (data) { // Notify weblet

            data = data || {};

            var badge = data.badge || 'default';
            var count = data.count || 0;
            var save = data.save || false;
            var id = data.id ? ':' + data.id : '';

            wceCmd("INGENICO:NOTIFY:" + badge + ":" + count + ":" + save + id);
            return this;
        },
        /***
         *
         * Add window tetra event
         *
         * @param eventName
         * @param callback
         * @param context
         * @returns {tetra}
         */
        on: function (eventName, callback, context) {

            // Manually start since 1.4.1
            if (eventName === 'wakeup') {
                tetra.createWakeupEvent();
            }

            context = context || this;

            // Register event as private
            events[eventName] = {
                eventName: eventName,
                callback: callback.bind(context),
                context: context
            };

            // Add listerner to window
            window.addEventListener(eventName, events[eventName].callback, false);

            return this;
        },
        /***
         *
         *  Trigger window tetra event
         *
         * @param eventName
         * @returns {tetra}
         */
        trigger: function (eventName, data) {

            data = data || {};

            function dispatch(eventName) {
                var event;

                event = new CustomEvent(eventName, data);

                // Dispatch event
                window.dispatchEvent(event);
            }

            if (!eventName) { // Trigger all events
                for (var evt in events) { // Remove regex
                    var evtName;
                    evtName = events[evt].eventName;

                    // Dispatch event
                    dispatch(evtName);
                }
            } else if (typeof eventName === 'string') { // Triggered string event
                dispatch(eventName);
            } else if (typeof eventName === 'object' && eventName instanceof Array) { // Triggered array of events
                for (var i = 0, len = eventName.length; i < len; i++) {

                    // Dispatch event
                    dispatch(eventName[i]);
                }
            } else {
                for (var evt in events) { // Triggered regex
                    var evtName;
                    evtName = events[evt].eventName;
                    if (evtName.match(eventName)) {

                        // Dispatch event
                        dispatch(evtName);
                    }
                }
            }

            return this;
        },
        /**
         * Remove window tetra events
         * */
        off: function (eventName, handler, context) {
            function remove(eventName) {
                // Remove event listenner from window
                window.removeEventListener(eventName, handler || events[eventName].callback, false);

                // Delete object
                delete events[eventName];
            }

            if (!eventName) { // Remove all events
                for (var evt in events) {
                    var evtName;
                    evtName = events[evt].eventName;
                    // Remove event
                    remove(evtName);
                }
            } else if (typeof eventName === 'string') { // Remove string event

                // Remove event
                remove(eventName);
            } else if (typeof eventName === 'object' && eventName instanceof Array) { // Remove array of events
                for (var i = 0, len = eventName.length; i < len; i++) {
                    // Remove event
                    remove(eventName[i]);
                }
            } else {
                for (var evt in events) { // Remove regex
                    var evtName;
                    evtName = events[evt].eventName;
                    if (evtName.match(eventName)) {
                        // Remove event
                        remove(evtName);
                    }
                }
            }

            return this;
        },
        id: function (options) {

            options = options || {};
            // Call by default on both
            options.then = options.then || 'both';
            var me = this;
            
            this.doPromise(options, function(onSuccess, onError, timeout) {

                websocket.check()
                .success(function(s) {
                    if (s) {
                        websocket.request("weblet", {nm: "ID"})
                        .success(function(dt) {
                            return onSuccess(dt.id);
                        })
                        .error(onError);
                    } else {
                        // old style API (to be depricated)
                        var onSuccessWrapper = function(res) {
                            var r = JSON.parse(res.data);
                            if (r.nm == 'ID') {
                                return onSuccess(r.id);
                                ENV.webletId = r.id;
                            }
                        }
        
                        if (ENV.webletId === null) {
                            ws.call("ws://ws.webos/weblet", {nm: "ID"}, onSuccessWrapper, onError, timeout);
                        }
                        else {
                            return onSuccess(ENV.webletId);
                        }
                    }
                })
                .error(onError);
            });

            var ws = {
                call: function(uri, data, successCb, errorCb, to) {
                    if (me.cons === undefined) {
                        me.cons = [];
                    }
                    var send = function(conn) {
                        conn.onmessage = successCb;
                        conn.onerror = errorCb;
                        conn.onclose = function() {
                        for (var i = 0; i < me.cons.length; ++i){
                            if (me.cons[i].uri == uri) {
                                me.cons.clice(i, 1);
                                return;
                            }
                        } 
                        };
                        conn.send(JSON.stringify(data));
                    }
                    //find is not supported in old browsers
                    for (var i = 0; i < me.cons.length; ++i){
                        if (me.cons[i].uri == uri) {
                            send(me.cons[i].conn);
                            return;
                        }
                    } 
                    
                    var conn = new WebSocket(uri);
                    conn.onopen = function() {
                        send(conn);
                    };
                    me.cons.push({conn: conn, uri: uri});
                }
            };
            
            return this;
        },
        doPromise: function (options, fn) {
            return tetra.doPromise.apply(this, [options, fn]);
        },
        then: function (onSuccess, onError) {
            return tetra.then.call(this, onSuccess, onError);
        },
        catch: function (error) {
            return tetra.then.call(this, null, error);
        },
        success: function (success) {
            return tetra.then.call(this, success, null);
        },
        error: function (error) {
            return tetra.then.call(this, null, error);
        },
        resolve: function (response) {
            return tetra.resolve.call(this, response, this.handler);
        },
        reject: function (reason) {
            return tetra.reject.call(this, reason, this.handler);
        }
    },
    waas: function (interfaceName,options) {

        var service, evtSource,evtSourceWaas, events,namespace;

        namespace = interfaceName.replace(/\.\w+$/,'');

        options = options || {},
        events = [];
        if(websocketWAAS.supported){
            websocketWAAS.addInterface(interfaceName); 
        }

        function Waas() {

            // todo bug me

            var Send = function (method) {
                this.connectionId = null;
                this.sendResponse = function (data ,opts,callback, error, timeout, expect) {

                    var connectionId = '';

                    if(typeof opts === 'function') {
                        expect = arguments[4];
                        timeout = arguments[3];
                        error = arguments[2];
                        callback = arguments[1];
                    }

                    if(typeof opts === 'object' && opts.connectionId !== undefined  && CONFIG.WP_VERSION >= 2.06) {
                        connectionId = 'conn_id='+ opts.connectionId
                    }

                    if(this.connectionId  && CONFIG.WP_VERSION >= 2.06) {
                        connectionId = 'conn_id='+ this.connectionId;
                    }

                    http.post(CONFIG.WAAS_URL + '/' + interfaceName + '/' + method + '?' + connectionId, data || {}, callback, error, timeout, expect);
                    return this;
                };
            };

            return {
                clients:[],
                sendEvent: function (eventName, data, opts,callback, error, timeout, expect) {

                    var connectionId = '';

                    if(typeof opts === 'function') {
                        expect = arguments[5];
                        timeout = arguments[4];
                        error = arguments[3];
                        callback = arguments[2];
                    }
                    
                    if(websocketWAAS.supported) {
                        var eventDetl = {
                            eventName: eventName,
                            data: data,
                            callback: callback,
                            error: error,
                            expect: expect,
                            connectionId: null
                        }
                        if(typeof opts === 'object' &&  opts.connectionId !== undefined && CONFIG.WP_VERSION >= 2.06) {
                            eventDetl.connectionId = opts.connectionId;
                        }
                        websocketWAAS.sendEvent(interfaceName,eventDetl); 
                    } else {
                        if(typeof opts === 'object' && opts.connectionId !== undefined && CONFIG.WP_VERSION >= 2.06) {
                            connectionId = 'conn_id='+ opts.connectionId
                        }
                        http.post(CONFIG.WAAS_URL + '/' +  namespace + '.' + eventName + '?' + connectionId, data || {}, callback, error, timeout, expect);
                    }
                    return this;
                },
                on: function (eventName, properties, callBack) {

                    if (properties && typeof properties === 'function') {
                        callBack = properties;
                        properties = {};
                    }

                    var eventDetl = {
                        eventName: eventName,
                        properties: properties,
                        callBack: callBack
                    };
                    if(websocketWAAS.supported) {
                        websocketWAAS.registerEvent(interfaceName, eventDetl); 
                    } else {
                        events.push(eventDetl);
                    }

                    return this;
                },
                start: function () {

                    if(!CONFIG.WP_VERSION) {
                        setTimeout(function(){
                        service.start();
                        },250);

                        return this;
                    }
                
                    if(websocketWAAS.supported) {
                        websocketWAAS.configureService(interfaceName, service.clients, options.nopts === true); 
                    } else {
                        var params, multi = '', nopts = '';

                        params = '?';

                        for (var i = 0, len = events.length; i < len; i++) {
                            var event = events[i];
                            var properties = event.properties;
                            var eventName = event.eventName;

                            // Add perms parameters
                            if (properties.perms && typeof properties.perms === 'object' && properties.perms instanceof Array) {
                                params += 'perms_' + eventName + '=' + properties.perms.toString() + '&';
                            }

                            // Add format parameters
                            if (properties.formats) {

                                var UpperEventName = eventName[0].toUpperCase() + eventName.slice(1);

                                for (var format in properties.formats) {
                                    params += 'format_' + namespace + '.' + UpperEventName + format + '=' + properties.formats[format] + '&';
                                }
                            }

                        }

                        if(CONFIG.WP_VERSION >= 2.06) {
                            multi = 'multi';
                            params += multi;
                        }

                        if (options.nopts) {
                            nopts = '&nopts';
                            params += nopts;
                        }
                        

                        // Create events source
                        evtSource = new window.EventSource(CONFIG.WAAS_URL + '/' + interfaceName + params);
                        evtSourceWaas = new window.EventSource(CONFIG.WAAS_URL + '?' + multi + nopts);

                        // Add connect Listenner
                        evtSourceWaas.addEventListener(CONFIG.CONNECT_EVENT,function(data){
                            service.clients.push(data.id);
                        });
                        // Add disconnect Listenner
                        evtSourceWaas.addEventListener(CONFIG.DISCONNECT_EVENT,function(data){
                            service.clients.splice(service.clients.indexOf(data.id), 1);
                        });


                        // Add event listeners
                        for (var i = 0, len = events.length; i < len; i++) {
                            var event = events[i];

                            var send = new Send(event.eventName);
                            (function(send,event){

                                var attachedEventSource;
                                if(event.eventName === CONFIG.CONNECT_EVENT || event.eventName === CONFIG.DISCONNECT_EVENT) {
                                    evtSource.addEventListener(event.eventName,function(response) {
                                        event.callBack.call(this,response);
                                    }, false);
                                    evtSourceWaas.addEventListener(event.eventName,function(response) {
                                        event.callBack.call(this,response);
                                    }, false);
                                } else {
                                    evtSource.addEventListener(event.eventName, function(response) {
                                        var data = JSON.parse(response.data);
                                        send.connectionId = data.$wp_connId ||  data.id;
                                        event.callBack.call(send,response);
                                        send.connectionId = null;
                                    }, false);
                                }
                            })(send,event);
                        } 
                    }
                    return this;
                }
            };
        }

        service = new Waas(interfaceName);

        return service;
    },
    /***
     *
     * Creates a promise
     *
     * @param options
     * @param fn
     */
    doPromise: function (options, fn) {

        var me = this;

        function doPromise() {

            var promise;

            // Creates a new promise
            promise = new window.Promise(function (resolve, reject) {


                // Call the promise after a delay
                window.setTimeout(function () {

                    return fn(function (response) {

                        // Register Handler
                        me.handler.resolve = resolve;
                        me.handler.reject = reject;
                        me.handler.promise = promise;

                        me.resolve(response, me.handler);

                    }, function (reason) {

                        // Register Handler
                        me.handler.resolve = resolve;
                        me.handler.reject = reject;
                        me.handler.promise = promise;

                        me.reject(reason, me.handler);

                    }, getTimeout.call(me, options.requestTimeout)); // Pass AJAX timeout for service call

                }, getDelay.call(me, options.requestDelay));

            });

            return promise;
        }

        if (!this.promise || options.promise) {
            this.promise = doPromise();
        } else {
            var then = getThen.call(me, options.then);
            if (then === 'resolved') {
                me.success(doPromise)
            } else if (then === 'rejected') {
                me.error(doPromise)
            } else {
                me.then(doPromise, doPromise);
            }
        }

        if (options.error || options.success) {
            me.then(options.success, options.error);
        }

        return this;
    },
    then: function (onSuccess, onError) {

        var me = this;

        if (onSuccess && !onError) {
            me.promise = me.promise.then(function (response) {
                return onSuccess.call(me, response, me.handler);
                // return me.promise;
            });
        } else if (onSuccess && onError) {

            me.promise = me.promise.then(function (response) {
                return onSuccess.call(me, response, me.handler);
                    //return me.promise;
            },
            function (reason) {
                return onError.call(me, reason, me.handler);
                //   return me.promise;
            });
        }
        else {
            me.promise = me.promise.catch(function (reason) {
                return onError.call(me, reason, me.handler);
                //  return me.promise;
            });
        }

        return this;
    },
    /***
     *
     * Catch promise method
     *
     * @param error
     * @returns {me}
     */
    catch: function (error) {
        this.then(null, error);
        return this;
    },
    /***
     *
     * Success sugar for resolved promise
     *
     * @param success
     * @returns {me}
     */
    success: function (success) {
        this.then(success, null);
        return this;
    },
    /***
     *
     * Error sugar for rejected promise
     *
     * @param error
     * @returns {me}
     */
    error: function (error) {
        this.then(null, error);
        return this;
    },
    /***
     *
     * Resolve the current promise
     *
     * @param response
     * @returns {me}
     */
    resolve: function (response) {
        this.handler.resolve.call(this, response, this.handler);
        return this;
    },
    /***
     *
     * Reject the current promise
     *
     * @param reason
     * @returns {me}
     */
    reject: function (reason) {
        this.handler.reject.call(this, reason, this.handler);
        return this;
    },
    reset: function () {
        this.promise = null;
        return this;
    },
    checkServices: function (services, options) {
        var _services, me, tried, resolvePromise, rejectPromise;

        options = options || {};

        options.delay = options.delay || 1000;
        options.try = options.try || 20;
        options.then = options.then || 'both';

        me = this,
        tried = 0,
        _services = services.slice(0);

        function onSuccessWrapper() {
            _services.shift();
            tried = 0;
            check();
        }

        function onErrorWrapper() {
            tried++;
            setTimeout(check, options.delay);
        }

        function check() {
            if (_services.length && tried < options.try) {
                tetra
                    .reset()
                    .lookup(_services[0],
                        {
                            expect: function (r) {
                                return r && r.length;
                            }
                        }
                    )
                    .then(onSuccessWrapper, onErrorWrapper);

            } else {
                if (tried === options.try) {
                    rejectPromise(_services[0]);
                } else {
                    resolvePromise();
                }
            }
        }

        return me.doPromise({}, function (resolve, reject) {
            resolvePromise = resolve;
            rejectPromise = reject;
            check();
        });
    }
};

/**
 * Add window and document events
 * */
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        tetra.weblet.trigger('hide');
    } else {
        tetra.weblet.trigger('show');
    }
});

window.addEventListener("beforeunload", function (e) {
    e.preventDefault();
    tetra.weblet.trigger('close');

    tetra.disconnect();
});

/*** Listen to wakeup event on demand ***/
tetra.createWakeupEvent = function () {

    return tetra.service({ // Instantiate desktopenv service
            service: 'local.desktopenv.inactivityHandler',
            namespace: 'ingenico.desktopenv'
        })
        .reset() // Reset promise queue
        .disconnect() // Disconnect if already connected
        .close() // Close sse if already opened
        .connect() // Connect to service
        .open()  // Open SSE
        .on('WakeupEvent', function (r) { // listen to event
            // Trigger wakeup event
            tetra.weblet.trigger('wakeup', r.cause);
        });
};

// Get WP version in background
var version;
tetra.service({
    service: 'local.WebOs.Service',
    namespace: 'ingenico.webos'
})
.connect() // connect to service
.call('GetWPVersion')   // Get WP version
.success(function (r) { version  = parseFloat(r.version,10); }) // Assign response async...
.disconnect()
.then(function () {CONFIG.WP_VERSION = version;}); // Disconnect from service

tetra.header = {
	/**
	*	Show leds and header
	*/
	showAll: function () {
		wceCmd('INGENICO:HEADER-LEDS:show:show');
	},
	/**
	*	Hide leds and header
	*/
	hideAll: function () {
		wceCmd('INGENICO:HEADER-LEDS:hide:hide');
	},
	/**
	*	Show leds only
	*/
	showLeds: function () {
		wceCmd('INGENICO:HEADER-LEDS::show');
	},
	/**
	*	Hide leds only
	*/
	hideLeds: function () {
		wceCmd('INGENICO:HEADER-LEDS::hide');
	},
	/**
	*	Show header only
	*/
	showBanner: function () {
		wceCmd('INGENICO:HEADER-LEDS:show:');
	},
	/**
	*	Hide header only
	*/
	hideBanner: function () {
		wceCmd('INGENICO:HEADER-LEDS:hide:');
	}
};

/* Polyfill Notifcation */

// Store notifications
var _notifications = {};
// Save nofication service instance
var notificationService = null;
/**
* Creates a Web Notification
* @contructor
* @param {string} title                 - The title of the notification.
* @param {object} [options]             - Optionnal properties of the notification.
*  @property {string}  [tag]            - The id of the nification
*  @property {string}  [body]           - The content of the notification.
*  @property {boolean} [ing_buttons]    - Non standard, show buttons in notification.
*  @property {function} [onshow]        - Callback when notification is shown.
*  @property {function} [onclose]       - Callback when notification is closed.
*  @property {function} [onclick]       - Callback when notification is opened.
*/
var Notification = function (title, options) {

	  var me = this;

		// Title is Required
    if (typeof title !== 'string') {
        return new Error('Title is required');
    }

		// Defines properties
    options = options || {};

    var data = {};

    this.title = data.title = title;
		this.tag = data.tag = (options.tag || Math.random()) + '';
		this.ing_buttons = data.ing_buttons = options.ing_buttons || false;

    if (options.body) {
        data.body = options.body;
    }

		if (options.onshow) {
			this.onshow = options.onshow;
		}

		if (options.onclose) {
			this.onclose = options.onclose;
		}

		if (options.onshow) {
			this.onclick = options.onclick;
		}


		/**
		* Process callbacks
		* @private
		* @param {string} evtName(onshow|onclose|onclick)    - Callback name to call.
		* @param {object} data                               - The notification properties.
		* @param {boolean}  remove                           - Should remove the nofication.
		*/
		function processEvent(evtName,data,remove) {
			// if any tag, process one notification
			if(data.tag && data.tag !== '') {
				// Check if notification exist and trigger callback
				_notifications[data.tag] && _notifications[data.tag][evtName] && _notifications[data.tag][evtName](_notifications[data.tag]);
					// Delete if needed
				 remove && delete _notifications[data.tag];
			}
			// Claim to remove all notifcations
			 else {
				// Loop on notifcations instances
				for(var tag in _notifications) {
					// Check if notification exist and trigger callback
					_notifications[tag][evtName] && _notifications[tag][evtName](_notifications[tag]);
						// Delete if needed
					remove && delete _notifications[tag];
				}
			}
		}

		// Creates singleton
		if(!notificationService) {

			// Create service instance
			notificationService =  tetra.service({
							service: 'local.webapp.' + CONFIG.DESKTOP_WAID,
							namespace: 'ingenico.webos'
					})
				.reset() // Reset promise queue
				.connect() // Connect to service
				.open() // Open SSE communication
				// Listen to event ShowNotificationEvent
				.on('ShowNotificationEvent', function (data) {
						// Call the show callback attached to the notifcation
						 processEvent('onshow',data);
				 })
				 // Listen to event ClickNotificationEvent
				 .on('ClickNotificationEvent', function (data) {
					 	// Call the click callback attached to the notifcation
						 processEvent('onclick',data,true);
				 })
				  // Listen to event CloseNotificationEvent
				 .on('CloseNotificationEvent', function (data) {
					 // Call the close callback attached to the notifcation
					 processEvent('onclose',data,true);
				 })
				 // Send message Notification
				 // Send the notifcation to WebDesktop Service
				 .call('Notification', {
						 data: data
				 })

		} else {
			// Use singleton
			notificationService
			.reset() // Reset promise queue
			// Send message Notification
			// Send the notifcation to WebDesktop Service
			.call('Notification', {
					data: data
			})
		}

		/** Close the notifcation from instance */
		this.close = function() {
				notificationService
				.reset() // Reset promise queue
				// Send message CloseNotification
				.call('CloseNotification',{
					data:{
						tag:data.tag
					}
				}).then(function() {
						// Call the close callback attached to the notifcation
						processEvent('onclose',data,true);
				})
		};


	// Save notification instance
	_notifications[data.tag] = this;

		// Return instance
    return this;
};

// Expose notification to window global object
window.Notification = Notification;

/**
* Extend tetra namespace
* This namesapce is defined for printer definition
*/
tetra.printer = {
	/* Set printer color conversion into diffuse mode. */
	setDiffuseMode: function () {
		wceCmd('INGENICO:WCE:printerDithering:diffuse');
	},
	/* Set printer color conversion into ordered mode. */
	setOrderedMode: function () {
		wceCmd('INGENICO:WCE:printerDithering:ordered');
	},
	/* Set printer color conversion into Threshold mode with a threshold value between 0 and 255.
	255 will convert all pixels to black (a full black page), 0 only black pixels are printed. (default value is 200) */
	setThreshold: function (value) {
		value = value || '';
		wceCmd('INGENICO:WCE:printerDithering:threshold:' + value)
	},

    callbackQueue: [],
    callbackRunning: false,
    serviceReady: false,
    prnService: null,
    evtCallbacks: {},
    errorHandler: function(s){ console.warn("Printer ERROR " + s);},    // Default error handler

    /**
    * Ensure printer service is ready, then invoke callback.
    * @param {function} callback - actual printer operation
    */
    start: function (callback) {
        var me = this;

        // Lookup service and create instance - only to be done once
        if (!me.serviceReady) {
            me.serviceReady = true;
            tetra.lookup("ingenico.device.printer.Printer")
            .then(function(response) {
                var serviceClass = response.services[0].id;
                console.log("Printer service: " + serviceClass);
                me.prnService = tetra.service ({
                    service: serviceClass,
                    namespace: 'ingenico.device.printer',
                });
                callback();
            }, function(err) {
                me.finish(err);
            })
        }
        else {
            // If previous print operation has not finished or service is not ready,
            // do not execute callback but put it on the queue instead
            if (me.callbackRunning || !me.prnService) {
                me.callbackQueue.push(callback);
            }
            else {
                callback();
            }
        }
        return this;
    },

    /**
    * Invoke error callback if necessary, then disconnect.
    * @param {string} or {Error object} [err]   - null if no error
    */
    finish: function (err) {
        var me = this;

        // Handle string or Error object accordingly
        if (typeof err == 'string') {
            me.evtCallbacks.onError(err);
        } else if (err) {
            var msg = (err.status || '') + '-' + (err.msg || '') + '-' + (err.response || '');
            me.evtCallbacks.onError(msg);
        }

        if (me.prnService) {
            // Always attempt to close and disconnect
            // NOTE: do disconnect before close to avoid getting stuck (an issue to be fixed in ESS)
            me.prnService
            .disconnect()
            .close()
            .success(function() {
                // If queue is not empty,invoke the next callback,
                // else indicate no more callback is running
                if (me.callbackQueue.length) {
                    me.callbackQueue.shift().call();
                }
                else {
                    me.callbackRunning = false;
                }
            })
            .error(function() {
                // For any error, clear running flag and callback queue
                me.callbackRunning = false;
                me.callbackQueue.length = 0;
            })
        }
        else {
            // If service instance is null, clear flag for next retry
            me.serviceReady = false;
            me.callbackRunning = false;
            me.callbackQueue.length = 0;
        }
    },

    /**
    * Process printer events.
    * @param {ingenico.device.printer.ChangedEvent object} evt
    */
    processEvent: function (evt) {
        var me = this;

        // Call event listeners if set
        me.evtCallbacks.onPrinting && me.evtCallbacks.onPrinting(evt.state.printing);
        me.evtCallbacks.onPaperOut && me.evtCallbacks.onPaperOut(evt.state.nopaper);
        me.evtCallbacks.onPaperLow && me.evtCallbacks.onPaperLow(evt.state.fewpaper);
        me.evtCallbacks.onTrayOpened && me.evtCallbacks.onTrayOpened(evt.state.opened);
    },

    /**
    * Print the current document on terminal printer.
    */
    print: function () {
        var me = this;

        return me.start(function() {
            var printStarted = false;
            var stillPrinting = false;
            var timer = 0;

            me.callbackRunning = true;
            me.prnService
            .reset()
            .connect()
            .open()
            .on('ChangedEvent',function(e) {
                /*
                console.warn("Printer ChangedEvent jobID= " + e.state.jobid);
                console.log("Printer state printing " + e.state.printing);
                console.log("Printer state  nopaper " + e.state.nopaper);
                console.log("Printer state fewpaper " + e.state.fewpaper);
                console.log("Printer state   opened " + e.state.opened);
                */
                if (e.state.printing) {
                    // Indicate printing is ongoing
                    stillPrinting = true;

                    // But only the first start event will be reported
                    // (since there are multiple start events for multi-page print)
                    if (!printStarted) {
                        printStarted = true;
                        me.processEvent(e);
                    }
                }
                else {
                    // Printing stopped (or paused for multi-page print)
                    // Set a 1-shot timer to ensure all printing has finished
                    // (During multi-page print, printing=true events usually
                    // arrive <50ms after the previous printing=false. A timeout
                    // of 200ms is used just to be sure.)
                    stillPrinting = false;
                    if (timer) {
                        // Stop previous timer before starting new
                        clearTimeout(timer);
                    }
                    timer = setTimeout(function() {
                        if (!stillPrinting && printStarted) {
                            printStarted = false;
                            me.processEvent(e);
                            me.finish();
                            console.log("Printer PRINT FINISHED");
                        }
                    }, 200);
                }
            })
            .call('JobControl')
            .success(function(r) {
                /*
                console.warn("Printer SUCCESS JobControl jobID= " + r.state.jobid);
                console.log("Printer state printing " + r.state.printing);
                console.log("Printer state  nopaper " + r.state.nopaper);
                console.log("Printer state fewpaper " + r.state.fewpaper);
                console.log("Printer state   opened " + r.state.opened);
                */
                // Call JobControl mainly to check states before printing
                // NOTE: These states are not reliable before SDK 11.16.01
                if ((r.state.nopaper === true) || (r.state.opened === true)) {
                    me.processEvent(r);
                    me.finish('Failed to print');
                }
                else {
                    window.print();
                }
            })
            .error(function(e) {
                me.finish(e);
            })
        });
        return this;
    },

    /**
    * Get current state of terminal printer.
    */
    getState: function () {
        var me = this;

        return me.start(function() {
            me.callbackRunning = true;
            me.prnService
            .reset()
            .connect()
            .call('JobControl')
            .success(function(r) {
                // JobControl always returns the latest state of printer
                me.processEvent(r);
                me.finish();
            })
            .error(function(e) {
                me.finish(e);
            })
        });
        return this;
    },

    /**
    * Set printer event listener callbacks.
    * @param {object} [callbacks]           - Optional (empty to remove callbacks)
    *  @property {function} [onPrinting]    - Callback printing state {boolean}
    *  @property {function} [onPaperOut]    - Callback paper out state {boolean}
    *  @property {function} [onPaperLow]    - Callback paper low state {boolean}
    *  @property {function} [onTrayOpened]  - Callback tray opened state {boolean}
    *  @property {function} [onError]       - Callback error message {string}
    */
    setEventListeners: function (callbacks) {
        var me = this;

        // Set up event listener callbacks
        // Default error handler will be used if onError is not provided
        me.evtCallbacks = callbacks || {};
        if (!me.evtCallbacks.onError)
            me.evtCallbacks.onError = me.errorHandler;
    }
};

/**
* Extend tetra namespace
* This namesapce is defined for signature pad definition
*/
tetra.sigpad = {
    /**
    *   Create and show the signature pad:
    *   - area   = {x, y, w, h}
    *   - config = {bg, fg, pw}
    *       - bg = background color
    *       - fg = foreground (pen) color
    *       - pw = pen width in pixels
    */
    open: function (area, config) {
        if ((area.x === undefined) || (area.y === undefined)|| (area.w === undefined)|| (area.h === undefined)) {
            //console.warn("WARN Area is required");
            return new Error('Area is required');
        }
        config = config || {};
        config.bg = config.bg || 'white';
        config.fg = config.fg || 'black';
        config.pw = config.pw || 2;
        wceCmd('INGENICO:SIGPAD:open:' + area.x + ':' + area.y + ':' + area.w + ':' + area.h + ':' + config.bg + ':' + config.fg + ':' + config.pw);
    },
    /**
    *   Hide and destroy the signature pad object
    *   (Saved images will not be deleted)
    */
    close: function () {
        wceCmd('INGENICO:SIGPAD:close');
    },
    /**
    *   Clear pad with background color for restart
    */
    clear: function () {
        wceCmd('INGENICO:SIGPAD:clear');
    },
    /**
    *   Stop further input on the signature pad
    *   (Input will be allowed again after clear)
    */
    stop: function () {
        wceCmd('INGENICO:SIGPAD:stop');
    },
    /**
    *   Save signature as an image file:
    *   - filename = Path/name relative to webapp private "noSync" directory
    *                Extension of filename depicts image format: png/jpg/ppm/bmp
    *   - quality  = Relative image quality (if applicable)
    *                Must be in the range 1..100, 0 = default setting
    */
    save: function (filename, quality) {
        if (typeof filename !== 'string') {
            //console.warn("WARN Filename is required");
            return new Error('Filename is required');
        }
        quality = quality || 0;
        wceCmd('INGENICO:SIGPAD:save:' + filename + ':' + quality);
    },
    /**
    *   Load a previously saved image file on signature pad
    *   - filename = Path/name relative to webapp private "noSync" directory
    */
    load: function (filename) {
        if (typeof filename !== 'string') {
            //console.warn("WARN Filename is required");
            return new Error('Filename is required');
        }
        wceCmd('INGENICO:SIGPAD:load:' + filename);
    }
};

/*
* Creates a StartEnd Service
* @param {object} [options]                       - Optionnal properties of the StartEnd.
*  @property {boolean}  [isStateConfigurable]     - Is the startend configurable.
*   @default true
*  @property {boolean}  [isEnabled]               - Default enable start end
*		 @default true
*  @property {string}  [disabledMode]             - Disabled mode
*   @default 'DISABLED'
*/
tetra.startEnd = function (properties) {

	// Defines variables and set properties
	var events, waas, supportedMethods,startEnd,isStateConfigurable,isEnabled,enabledMode;

	properties = properties || {};
	isStateConfigurable = properties.isStateConfigurable  === false ? false : true;
	isEnabled = properties.isEnabled  === false ? false : true;
	disabledMode = CONFIG.START_END.DISABLED[properties.disabledMode] || CONFIG.START_END.DISABLED.DISABLED;
	// Events store
	events = {};
	// Supported Methods store
	supportedMethods = [];

	/**
	* StartEnd Class
	* @constructor
	*/
	function StartEnd() {

		var that;

		that = this;

		// Set enabled flag
		that.enabled = isEnabled;

		// Creates Tetra Waas
		waas = tetra.waas('ingenico.transaction.StartEnd')
			// Listen to stateSE
			.on('stateSE', function (response) {
				var state = JSON.parse(response.data).set_state;

				// Change the state
				if (typeof state !== 'undefined') {
					var returnCode;
					// Change only if configurable
					if(isStateConfigurable) {
						if (state === 1) {
							that.enable();
						} else {
							that.disable();
						}
						returnCode = 0;
					} else {
						// Change error code if not configurable
						returnCode = -3000001;
					}

					return this.sendResponse({current_state: that.enabled,is_state_configurable:isStateConfigurable,return:returnCode});
				}
				// Get the state
				else {
					return this.sendResponse({current_state: that.enabled,is_state_configurable:isStateConfigurable,return:0});
				}
			})
			// Listen to getSEImplementedMethods
			.on('getSEImplementedMethods',
				function (e) {

					var result;
					// Skip startend completly if startend is totally disabled
					result = {
						"return": 1,
						"supportedMethods":  !that.enabled && disabledMode === CONFIG.START_END.DISABLED.DISABLED ? [] : supportedMethods
					};

					// Send response @waas
					this.sendResponse(result)

			})
			// Listen to executeSE
			.on('executeSE',
				{
					formats: { // Define input field as TLV
						'Request.input': 'tlv'
					}
				},
				function (e) {
					var data, handler, me,isShortMode,input;

					me = this;
					data = JSON.parse(e.data);
					// Get handler corresponding to event
					handler = events[data.serviceId];

					// Check if short mode
					isShortMode = disabledMode === CONFIG.START_END.DISABLED.SHORT && !that.enabled;
					input = data.input;

					// Search for short mode from tag
					for(var i = 0,len = input.length;i<len;i++) {
						var _tlv = input[i];
						if(_tlv.tag === '0x9F948927') {
							isShortMode = Number(_tlv.data) & 1;
							break;
						}
					}

					// Wrap sendResponse for retro-compatibility with mutli and single client
					that.sendResponse = function (tlv, callBack) {
						me.sendResponse.call(me, {
							"return": 1,
							"output": tlv
						},{connectionId:data.$wp_connId}, callBack);
					};

					// Direct send response if there is no callback defined
					if(!handler) {
						this.sendResponse({},{connectionId:data.$wp_connId});
					} else {
						// Call the callback, passing tlv and isShortMode flag
						handler.call(this, data.input,{isShortMode:isShortMode})
					}

				})
			// Starts the service
			.start();

		// Return StartEnd instance
		return this;

	};


	/* Method that disable startEnd */
	StartEnd.prototype.disable = function () {
		// Enable if disabled
		if(isStateConfigurable && this.enabled) {
			this.enabled = 0;
			// Send Tetra event
			tetra.weblet.trigger('SE_DISABLED');
		}
	};

	/* Method that enable startEnd */
	StartEnd.prototype.enable = function () {
		// Enable if enabled
		if(isStateConfigurable && !this.enabled) {
			this.enabled = 1;
			// Send Tetra event
			tetra.weblet.trigger('SE_ENABLED');
		}

	};

	/* sendResponse is override on each event */
	StartEnd.prototype.sendResponse = function () {
	};

	/*
	* Wrap Waas.on to map events
	* Listen to events
	* @param {string} eventName         - Name of the event.
	* @param {object} [options]          - Event properties.
	*  @property {Number} [priority]    - Event priority
	* @param {function} callBack        - Handler of listenner.
	*/
	StartEnd.prototype.on = function (eventName, options, callBack) {
		var supportedMethod;

		// check if options is passed and change parameter definition
		if (options && typeof options === "function") {
			events[eventName] = options;
			options = {};
		}

		// Register callback
		if (callBack) {
			events[eventName] = callBack;
		}

		supportedMethod = {};
		// Map eventName to real start end event name from Tetra config
		supportedMethod.id = CONFIG.START_END.METHODS[eventName].id;
		if (options && options.priority) {
			supportedMethod.priority = options.priority;
		}

		// Register methods
		supportedMethods.push(supportedMethod);

		// Return start end instance
		return startEnd;
	};


		// Creates StartEnd
		startEnd = new StartEnd();

		// Return startEnd instance
		return startEnd;
};

/**
* Extend tetra namespace
* This namesapce is defined for operating system calls
*/
tetra.system  = {
	/**
	* Launch an application (webapp or native app)
	* @param {object} properties     - Method properties.
	*  @property {string} [webApp]   - Webapp Id.
	*  @property {string} [path]     - Native app path (entryUrl)
	*/
	run:function(properties) {
		// Check if web application or native application
		var entryUrl = properties.webApp ? 'WebApps/' + properties.webApp : properties.path;

		// Creates service
		return tetra.service({
        service: 'local.desktopenv.explorer',
        namespace: 'ingenico.desktopenv'
    })
		.reset() // Reset promise queue
		.connect() // Connect to service
		.call('SelectIcon',{data:{entryUrl:entryUrl}}) // Send SelectIcon message with entryUrl
		.disconnect() // Disconnect from service
	}
};
 if (typeof module === "object" && module != null && module.exports) { module.exports = tetra; } else if (typeof define === "function" && define.amd) { define(function () { return tetra; });} else { window.tetra = tetra; }})(window,document);