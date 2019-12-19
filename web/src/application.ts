import * as $ from 'jquery';

declare global {
    var tetra: any;
}

export class Application
{
    constructor(private $app: JQuery<HTMLElement>) {

    }

    run() {
        try {
        this.initializeTetra();
        }catch(error) {

        }
        this.home();
    }

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

    private home()
    {
        this.$app.empty();
        
        $('<h1>', {
            html: 'App has been registered, go to payment app and select Sample APP'
        }).appendTo(this.$app);
    }

    private paymentMode(data: any) {
        this.$app.empty();
        
        $('<pre>', {
            html: `Received: ${JSON.stringify(data, null, 2)}`
        }).appendTo(this.$app);
    }
}