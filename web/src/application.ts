import * as $ from 'jquery';

declare global {
    var tetra: any;
}

const WEB_STATUS_SUCCESS = 0;
const WEB_STATUS_FAILURE = 1;
const WEB_STATUS_INVALID_PARAM = 2;

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
            "web": {
                "id": "6AD74E90", 
                "display_name": "Sample APP"
            },
            "reg_1": {
                "applicable_transactions": ["0"],
                "web": {
                    "srv_type": "2",
                    "dol": ["tran_status", "auth_amt"]
                },
                "core": {
                    "dol": ["tran_amt", "srv_type"]
                }
            },
            "reg_2": {
                "applicable_transactions": ["0"],
                "web": {
                    "srv_type": "3",
                    "dol": <string[]>[]
                },
                "core": {
                    "dol": ["tran_amt", "srv_type"]
                } 
            }
        };

        let request = JSON.stringify(regRequest);
        let requestData = {
            'registration_request': request
        }

        // then connects to the service
        serviceRegister.connect().call('RegisterApp', {
            data: requestData
        })
            .then(function(response: any) {
                console.log(response);
            })
            .disconnect();

        const application = this;
        tetra.waas('ingenico.coreapp.T3CoreService')
            .on('invoke', function(this: any, response: any) {

                //Perform the desired processing
                console.log("I'm a Pay with non-payment cards");

                //Return response + status of the invocation to Core Application
                const dataObj = JSON.parse(response.data);
                const invokeRequest = JSON.parse(dataObj.invoke_request);
                if (invokeRequest.core && invokeRequest.core.srv_type == 3) {
                    application.afterTransactionService(dataObj, this);
                } else {
                    application.paymentMode(dataObj, this);
                }
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

    private paymentMode(data: any, transactionScope: any) {

        tetra.weblet.show();
        this.$app.empty();

    
        $('<button>', {
            html: 'complete'
        }).appendTo(this.$app).click(() => {
            
            tetra.weblet.hide();
            const connectionId = data["$wp_connId"];
            const invokeRequest = JSON.parse(data.invoke_request);
            const amount = invokeRequest.core.tran_amt;
            const response = {
                "web":{
                    "tran_status": 0,
                    "auth_amt": amount,
                }
            };

            var invokeResponse = JSON.stringify(response);
            
            transactionScope.sendResponse({
                invoke_response: invokeResponse, 
                invoke_status: WEB_STATUS_SUCCESS
            }, {
                connectionId: connectionId
            });
        });

        $('<pre>', {
            html: `Received: ${JSON.stringify(data, null, 2)}`
        }).appendTo(this.$app);


    }

    private afterTransactionService(data: any, transactionScope: any) {

        tetra.weblet.show();
        this.$app.empty();

        $('<button>', {
            text: 'complete',
        }).appendTo(this.$app).click(() => {
            tetra.weblet.hide();
            const connectionId = data["$wp_connId"];
            transactionScope.sendResponse({
                invoke_response: {},
                invoke_status: WEB_STATUS_SUCCESS
            }, {
                connectionId: connectionId
            });
        });      

    }
}