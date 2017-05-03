/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 1);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
__webpack_require__(2);
class Cookies {
    constructor() {
        this.session_id = null;
    }
    delete_sessionId() {
        this.session_id = null;
        document.cookie = `session_id=; expires=${(new Date()).toUTCString()}`;
    }
    get_sessionId() {
        return document
            .cookie.split("; ")
            .filter(x => { return x.indexOf("session_id") === 0; })
            .map(x => { return x.split("=")[1]; })
            .pop() || this.session_id || "";
    }
    set_sessionId(val) {
        document.cookie = `session_id=${val}`;
        this.session_id = val;
    }
}
class OdooRPC {
    constructor() {
        this.uniq_id_counter = 0;
        this.shouldManageSessionId = false; // try without first
        this.context = JSON.parse(localStorage.getItem("user_context")) || { "lang": "en_US" };
        this.cookies = new Cookies();
    }
    buildRequest(url, params) {
        this.uniq_id_counter += 1;
        if (this.shouldManageSessionId) {
            params.session_id = this.cookies.get_sessionId();
        }
        let json_data = {
            jsonrpc: "2.0",
            method: "call",
            params: params,
        };
        this.headers = new Headers({
            "Content-Type": "application/json",
            "X-Openerp-Session-Id": this.cookies.get_sessionId(),
            "Authorization": `Basic ${btoa(this.http_auth)}`
        });
        return {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: params,
            })
        };
    }
    handleOdooErrors(response) {
        if (!response.error) {
            return response.result;
        }
        let error = response.error;
        let errorObj = {
            title: "    ",
            message: "",
            fullTrace: error
        };
        if (error.code === 200 && error.message === "Odoo Server Error" && error.data.name === "werkzeug.exceptions.NotFound") {
            errorObj.title = "page_not_found";
            errorObj.message = "HTTP Error";
        }
        else if ((error.code === 100 && error.message === "Odoo Session Expired") ||
            (error.code === 300 && error.message === "OpenERP WebClient Error" && error.data.debug.match("SessionExpiredException")) // v7
        ) {
            errorObj.title = "session_expired";
            this.cookies.delete_sessionId();
        }
        else if ((error.message === "Odoo Server Error" && /FATAL:  database "(.+)" does not exist/.test(error.data.message))) {
            errorObj.title = "database_not_found";
            errorObj.message = error.data.message;
        }
        else if ((error.data.name === "openerp.exceptions.AccessError")) {
            errorObj.title = "AccessError";
            errorObj.message = error.data.message;
        }
        else {
            let split = ("" + error.data.fault_code).split("\n")[0].split(" -- ");
            if (split.length > 1) {
                error.type = split.shift();
                error.data.fault_code = error.data.fault_code.substr(error.type.length + 4);
            }
            if (error.code === 200 && error.type) {
                errorObj.title = error.type;
                errorObj.message = error.data.fault_code.replace(/\n/g, "<br />");
            }
            else {
                errorObj.title = error.message;
                errorObj.message = error.data.debug.replace(/\n/g, "<br />");
            }
        }
        return Promise.reject(errorObj);
    }
    handleHttpErrors(response) {
        if (response.ok) {
            return response.json();
        }
        return Promise.reject(response.message || response);
    }
    init(configs) {
        this.odoo_server = configs.odoo_server;
        this.http_auth = configs.http_auth || null;
    }
    setOdooServer(odoo_server) {
        this.odoo_server = odoo_server;
    }
    setHttpAuth(http_auth) {
        this.http_auth = http_auth;
    }
    sendRequest(url, params) {
        let options = this.buildRequest(url, params);
        return fetch(this.odoo_server + url, options)
            .then(this.handleHttpErrors)
            .then(this.handleOdooErrors);
    }
    getVersionInfo() {
        return this.sendRequest("/web/webclient/version_info", {});
    }
    getVersionNumber() {
        return this.getVersionInfo().then(version_info => {
            return parseFloat(version_info.server_serie);
        });
    }
    getSessionInfo() {
        return this.sendRequest("/web/session/get_session_info", {});
    }
    login(db, login, password) {
        let params = {
            db: db,
            login: login,
            password: password
        };
        let $this = this;
        return this.sendRequest("/web/session/authenticate", params).then(function (result) {
            if (!result.uid) {
                $this.cookies.delete_sessionId();
                return Promise.reject({
                    title: "wrong_login",
                    message: "Username and password don't match",
                    fullTrace: result
                });
            }
            $this.context = result.user_context;
            localStorage.setItem("user_context", JSON.stringify($this.context));
            $this.cookies.set_sessionId(result.session_id);
            return result;
        });
    }
    isLoggedIn(force = true) {
        if (!force) {
            return Promise.resolve(this.cookies.get_sessionId().length > 0);
        }
        return this.getSessionInfo().then((result) => {
            this.cookies.set_sessionId(result.session_id);
            return !!(result.uid);
        });
    }
    logout(force = true) {
        this.cookies.delete_sessionId();
        if (force) {
            return this.getSessionInfo().then((r) => {
                if (r.db)
                    return this.login(r.db, "", "");
            });
        }
        else {
            return Promise.resolve();
        }
    }
    getDbList() {
        return this.getVersionNumber().then(version => {
            console.log(version);
            if (version == 9) {
                let url = "/jsonrpc";
                let params = {
                    "method": "list",
                    "service": "db",
                    "args": []
                };
                return this.sendRequest(url, params);
            }
            if (version > 9) {
                return this.sendRequest("/web/database/list", {});
            }
            return this.sendRequest("/web/database/get_list", {});
        });
    }
    searchRead(model, domain, fields, limit) {
        let params = {
            model: model,
            domain: domain,
            fields: fields,
            limit: limit,
            context: this.context
        };
        return this.sendRequest("/web/dataset/search_read", params);
    }
    updateContext(context) {
        localStorage.setItem("user_context", JSON.stringify(context));
        let args = [[this.context.uid], context];
        this.call("res.users", "write", args, {})
            .then(() => this.context = context)
            .catch((err) => this.context = context);
    }
    getContext() {
        return this.context;
    }
    call(model, method, args, kwargs) {
        kwargs = kwargs || {};
        kwargs.context = kwargs.context || {};
        Object.assign(kwargs.context, this.context);
        let params = {
            model: model,
            method: method,
            args: args,
            kwargs: kwargs,
        };
        return this.sendRequest("/web/dataset/call_kw", params);
    }
}
exports.OdooRPC = OdooRPC;


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const odoorpc_1 = __webpack_require__(0);
let configs = {
    odoo_server: "https://odoo-server",
    http_auth: "http_auth_user:http_auth_pass"
};
let odoo = new odoorpc_1.OdooRPC();
odoo.init(configs);
let db_list = odoo.getDbList().then(data => {
    console.log(data);
});
odoo.login('database', 'admin', 'password').then(data => {
    console.log(data);
});


/***/ }),
/* 2 */
/***/ (function(module, exports) {

(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue+','+value : value
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = String(input)
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    rawHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = 'status' in options ? options.status : 200
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);


/***/ })
/******/ ]);