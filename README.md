# Sample

This sample displays the issue we have, we are trying to integrate with the feature Non Payment Card of the Core app Services.

# How to build 

Navigate to the /web folder.

run ```npm install```

Once node_modules are install you can run

```npm run build:prod``` will will populate the /web/dist folder used by the tetra project to be used inside the terminal.

# In application.ts we do the following.

> It does work because we see our application when we start a Sale with the core application, we can select Sample APP.

The **issue** is when we select the Sample APP to do a **NON PAYMENT CARD** it never opens the sample app and just crashes the home screen.

```ts
private initializeTetra() {

    const serviceRegister = tetra.service({
        service: 'local.service.T3CoreService',
        namespace: 'ingenico.coreapp'
    });

    let applicationName: string = 'Sample APP';


    const regRequest = {
        "applicable_transactions": ["0"],
        "web": {
            "id": "E829AB3A", // <-- your tetra id.
            "srv_type": "2",
            "display_name": applicationName,
            "dol": ["tran_status", "auth_amt"]
        },
        "core": {
            "dol": ["tran_amt"]
        }
    };

    let request = JSON.stringify(regRequest);
    let requestData = {
        'registration_request': request
    }

    // then connects to the service
    serviceRegister.connect().call('RegisterApp', {
        data: requestData
    });

    tetra.waas('ingenico.coreapp.T3CoreService')
        .on('invoke', function(this: any, data: any) {

            //Perform the desired processing
            console.log("I'm a Pay with non-payment cards");

            //Return response + status of the invocation to Core Application
            const dataObj = JSON.parse(data.data);

            this.paymentMode(dataObj);

            /*
            const connID = dataObj["$wp_connId"];

            var response = {
                "web":{
                    "tran_status": 0,
                    "auth_amt": 500,
                }
            };

            var invokeResponse = JSON.stringify(response);
            this.sendResponse({
                invoke_response: invokeResponse, 
                invoke_status: WEB_STATUS_SUCCESS
            }, {
                connectionId: connID
            });*/
        })
        .start();
}
```