import {OdooRPC} from "../lib/odoorpc";

let configs = {
    odoo_server: "https://odoo-server",
    http_auth: "http_auth_user:http_auth_pass"
};
let odoo = new OdooRPC();
odoo.init(configs);

let db_list = odoo.getDbList().then(data => {
    console.log(data);
});

odoo.login('database', 'admin', 'password').then(data => {
    console.log(data);
});