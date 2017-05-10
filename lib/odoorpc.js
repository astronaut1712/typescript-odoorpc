"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("whatwg-fetch");
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
                    "args": new Array()
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
