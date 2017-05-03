# OdooRPC

## How to use

`npm install odoorpc` or `yarn add odoorpc`


### typescript

```typescript
import {OdooRPC} from "odoorpc";

let configs = {
    odoo_server: "https://odoo-server",
    http_auth: "basic_auth_user:basic_auth_pass"
};
let odoo = new OdooRPC();
odoo.init(configs);

let db_list = odoo.getDbList().then(data => {
    console.log(data);
});

odoo.login('database_name', 'admin', 'password').then(data => {
    console.log(data);
});
```

### javascript

```javascript
var odoorpc = require("odoorpc");

let configs = {
    odoo_server: "https://odoo-server",
    http_auth: "basic_auth_user:basic_auth_pass"
};
let odoo = new odoorpc.OdooRPC();
odoo.init(configs);

let db_list = odoo.getDbList().then(data => {
    console.log(data);
});

odoo.login('database_name', 'admin', 'password').then(data => {
    console.log(data);
});

```