"use strict";
exports.__esModule = true;
require("whatwg-fetch");
var Cookies = (function () {
    function Cookies() {
        this.session_id = null;
    }
    Cookies.prototype.delete_sessionId = function () {
        this.session_id = null;
        document.cookie = "session_id=; expires=" + (new Date()).toUTCString();
    };
    Cookies.prototype.get_sessionId = function () {
        return document
            .cookie.split("; ")
            .filter(function (x) { return x.indexOf("session_id") === 0; })
            .map(function (x) { return x.split("=")[1]; })
            .pop() || this.session_id || "";
    };
    Cookies.prototype.set_sessionId = function (val) {
        document.cookie = "session_id=" + val;
        this.session_id = val;
    };
    return Cookies;
}());
var OdooRPC = (function () {
    function OdooRPC() {
        this.uniq_id_counter = 0;
        this.shouldManageSessionId = false; // try without first
        this.context = JSON.parse(localStorage.getItem("user_context")) || { "lang": "en_US" };
        this.cookies = new Cookies();
    }
    OdooRPC.prototype.buildRequest = function (url, params) {
        this.uniq_id_counter += 1;
        if (this.shouldManageSessionId) {
            params.session_id = this.cookies.get_sessionId();
        }
        var json_data = {
            jsonrpc: "2.0",
            method: "call",
            params: params
        };
        this.headers = new Headers({
            "Content-Type": "application/json",
            "X-Openerp-Session-Id": this.cookies.get_sessionId(),
            "Authorization": "Basic " + btoa(this.http_auth)
        });
        return {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: params
            })
        };
    };
    OdooRPC.prototype.handleOdooErrors = function (response) {
        if (!response.error) {
            return response.result;
        }
        var error = response.error;
        var errorObj = {
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
            var split = ("" + error.data.fault_code).split("\n")[0].split(" -- ");
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
    };
    OdooRPC.prototype.handleHttpErrors = function (response) {
        if (response.ok) {
            return response.json();
        }
        return Promise.reject(response.message || response);
    };
    OdooRPC.prototype.init = function (configs) {
        this.odoo_server = configs.odoo_server;
        this.http_auth = configs.http_auth || null;
    };
    OdooRPC.prototype.setOdooServer = function (odoo_server) {
        this.odoo_server = odoo_server;
    };
    OdooRPC.prototype.setHttpAuth = function (http_auth) {
        this.http_auth = http_auth;
    };
    OdooRPC.prototype.sendRequest = function (url, params) {
        var options = this.buildRequest(url, params);
        return fetch(this.odoo_server + url, options)
            .then(this.handleHttpErrors)
            .then(this.handleOdooErrors);
    };
    OdooRPC.prototype.getVersionInfo = function () {
        return this.sendRequest("/web/webclient/version_info", {});
    };
    OdooRPC.prototype.getVersionNumber = function () {
        return this.getVersionInfo().then(function (version_info) {
            return parseFloat(version_info.server_serie);
        });
    };
    OdooRPC.prototype.getSessionInfo = function () {
        return this.sendRequest("/web/session/get_session_info", {});
    };
    OdooRPC.prototype.login = function (db, login, password) {
        var params = {
            db: db,
            login: login,
            password: password
        };
        var $this = this;
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
    };
    OdooRPC.prototype.isLoggedIn = function (force) {
        var _this = this;
        if (force === void 0) { force = true; }
        if (!force) {
            return Promise.resolve(this.cookies.get_sessionId().length > 0);
        }
        return this.getSessionInfo().then(function (result) {
            _this.cookies.set_sessionId(result.session_id);
            return !!(result.uid);
        });
    };
    OdooRPC.prototype.logout = function (force) {
        var _this = this;
        if (force === void 0) { force = true; }
        this.cookies.delete_sessionId();
        if (force) {
            return this.getSessionInfo().then(function (r) {
                if (r.db)
                    return _this.login(r.db, "", "");
            });
        }
        else {
            return Promise.resolve();
        }
    };
    OdooRPC.prototype.getDbList = function () {
        var _this = this;
        return this.getVersionNumber().then(function (version) {
            console.log(version);
            if (version == 9) {
                var url = "/jsonrpc";
                var params = {
                    "method": "list",
                    "service": "db",
                    "args": []
                };
                return _this.sendRequest(url, params);
            }
            if (version > 9) {
                return _this.sendRequest("/web/database/list", {});
            }
            return _this.sendRequest("/web/database/get_list", {});
        });
    };
    OdooRPC.prototype.searchRead = function (model, domain, fields, limit) {
        var params = {
            model: model,
            domain: domain,
            fields: fields,
            limit: limit,
            context: this.context
        };
        return this.sendRequest("/web/dataset/search_read", params);
    };
    OdooRPC.prototype.updateContext = function (context) {
        var _this = this;
        localStorage.setItem("user_context", JSON.stringify(context));
        var args = [[this.context.uid], context];
        this.call("res.users", "write", args, {})
            .then(function () { return _this.context = context; })["catch"](function (err) { return _this.context = context; });
    };
    OdooRPC.prototype.getContext = function () {
        return this.context;
    };
    OdooRPC.prototype.call = function (model, method, args, kwargs) {
        kwargs = kwargs || {};
        kwargs.context = kwargs.context || {};
        Object.assign(kwargs.context, this.context);
        var params = {
            model: model,
            method: method,
            args: args,
            kwargs: kwargs
        };
        return this.sendRequest("/web/dataset/call_kw", params);
    };
    return OdooRPC;
}());
exports.OdooRPC = OdooRPC;
