# Sample

This sample displays the issue we have, we are trying to integrate multi registration of non payment card and after transaction service.

# How to build 

Navigate to the /web folder.

run ```npm install```

Once node_modules are install you can run

```npm run build:prod``` will will populate the /web/dist folder used by the tetra project to be used inside the terminal.

# In application.ts we do the following.

> the application registration returns status 0 (non registered event though we follow the guidelines of multiple registration)

see [application file](./web/src/application.ts)

based on documentation that says

```

 The keyword “reg_n” (n can be “1”, “2” or “3”) is crucial and it is case sensitive.
- Registration request in legacy mode remains supported (Mono Registration service) as shown in
the code sample below
- In some cases, the payment application couldn’t treat a registration request for being busy with
another processing. In that case, the Web App launcher will receive an error which indicates that
the payment application is busy (See section 8.2.1).

```

Sample shows

```js
//The code below registers a Web App with an ID set to “ABCD1234” then checks if it was successfully registered.
var register_cfg = {
  "web": {
    "id": "ABCD1234", //Web App ID
    "display_name": "Sample App", //display name
  },
  "reg_1": {
    "applicable_transactions": ["0", "3"], //sale & return
    "web": {
      "srv_type": "3", // After transaction
      "dol": [] // Web service output parameters
    },
    "core": {
      "dol": [] //Web service input parameters
    }
  },
  "reg_2": {
    "applicable_transactions": ["0"], //sale & return
    "web": {
      "srv_type": "2", // Pay with non-payment cards
      "dol": ["tran_status", "auth_amt", "tran_date", "tran_time"] // Web service output parameters
    },
    "core": {
      "dol": [“tran_amt”] //Web service input parameters
    }
  },
  "reg_3": {
    "applicable_transactions": ["0", "3"], //sale & return
    "web": {
      "srv_type": "1", // Before transaction
      "dol": ["tran_amt"] // Web service output parameters
    },
    "core": {
      "dol": ["tran_amt"] //Web service input parameters
    }
  }
};
var register_service = tetra.service({
  service: 'local.service.T3CoreService',
  namespace: 'ingenico.coreapp'
});
var reg_request = JSON.stringify(register_cfg);
var Data = {
  'registration_request': reg_request
}
register_service
  .connect()
  .call('RegisterApp',
    {
      data: Data
    }
  )
  .then(function (response) {
    var res = parseInt(response.registration_status);
    switch (res) {
      case 0:
        alert("Application not registered");
        break;
      case 1:
        alert("Application registered");
        break;
      default:
        alert("An error occured");
        break;
    }
  })
  .disconnect();
```