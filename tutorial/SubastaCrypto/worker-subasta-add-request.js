var amqp = require('amqplib/callback_api');

//CONFIGURACION RABBITMQ
const _server = 'amqp://localhost';
const _queue_name = "subasta.request.queue";
const utf8EncodeText = new TextEncoder();

//CONFIGURACION WEB3 Y CONTRATO SimpleAuction
const { Web3 } = require("web3");
const solc = require("solc");
const path = require("path");
const fs = require("fs");

//FIN CONFIGURACION WEB3 Y CONTRATO SimpleAuction




//1) Escuchar cola subasta.request.queue 
amqp.connect(_server, function(error0, connection) {
    if (error0) {
      throw error0;
    }
    connection.createChannel(function(error1, channel) {
      if (error1) {
        console.log("Error al crear canal:", error1);
        throw error1;
      }
      channel.assertQueue(_queue_name, {
        durable: true
      });
      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", _queue_name);
      channel.consume(_queue_name, function(msg) {
      console.log(" [x] Received %s", msg.content.toString());
      //convertir los datos recibidos a un json
      json_request_dto = JSON.parse(msg.content.toString());
      console.log("json_request_dto: ",json_request_dto);
      //interactura con el contrato, enviar oferta
      //fnCompilarContrato(json_request_dto);
      fnDeployContrato(json_request_dto);

    }, {
    noAck: true
  });
    });
  });


async function fnDeployContrato(json_request_dto ) {
  try {    
    const web3 = new Web3("http://127.0.0.1:7545/");

    const contractName = 'SimpleAuction'; 
    const fileName = `${contractName}.sol`;
    console.log("contractName: ", contractName);
    const contractNameByteCode = contractName + "Bytecode.bin";
    const contractNameAbi = contractName + "Abi.json";
    const bytecodePath = path.join(__dirname, contractNameByteCode);
    const bytecode = fs.readFileSync(bytecodePath, "utf8");
    const abi = require("./"+contractNameAbi);
    const currentContract = new web3.eth.Contract(abi);
    currentContract.handleRevert = true;

    const deployerAccount = json_request_dto.address_beneficiario;//providersAccounts[0];
    console.log("Deployer account:", deployerAccount);
    const biddingTime = json_request_dto.duracion;
    const beneficiaryAddress = json_request_dto.address_beneficiario;
    const contractDeployer = currentContract.deploy({
      data: "0x" + bytecode,
      arguments: [biddingTime, beneficiaryAddress],
    });
    const gas = await contractDeployer.estimateGas({
      from: deployerAccount,
    });
    console.log("Estimated gas:", gas);
    const tx = await contractDeployer.send({
      from: deployerAccount,
      gas,
      gasPrice: 10000000000,
    })
    .on('transactionHash', function(hash){
      console.log('Hash de la transacción:', hash);
    }).on('receipt', (receipt) => {
      console.log('Receipt:', receipt);
      //enviar respuesta de deploy
      var j = {
        "id":json_request_dto.id,
        "address_contrato": receipt.contractAddress,
        "estado":2,
        "tx_hash":receipt.transactionHash,
        "mensaje":"subasata generada correctamente"
      }
      fnPublicarMensajeMQ('subasta.response.queue',j);

    })
    .on('error', function(error){
      console.error('Error al desplegar el contrato:', error);
      console.error(error);
      var j = {
        "id":json_request_dto.id,
        "address_contrato": "",
        "estado":3,
        "tx_hash":"",
        "mensaje":"error: "+error
      }
      fnPublicarMensajeMQ("subasta.response.queue", json_response);
    });
    

    
  } catch (error) {
    console.error(error);
    var j = {
      "id":json_request_dto.id,
      "address_contrato": "",
      "estado":3,
      "tx_hash":"",
      "mensaje":"error: "+error
    }
    fnPublicarMensajeMQ("subasta.response.queue", json_response);
  }
}





async function fnPublicarMensajeMQ(_queue, _json){
  console.log("Se agrega transaccion a ..."+ _queue);
  console.log("fnPublicarMensajeMQ.json: ",_json);
  //conecta a rabbitmq
  amqp.connect('amqp://localhost', function(error0, connection) {
    if (error0) {
        console.log("fallo al momento de conectar con rabbit");
    }

    connection.createChannel(function(error1, channel) { 
      if (error1) {
          console.log("fallo al momento de conectar con el canal");
      }
      
      //conecta a cola
      channel.assertQueue(_queue, {
          durable: true
      });

      //parsear a string luego a byte utf-8
      json_string = JSON.stringify(_json)
      const json_byteArray = utf8EncodeText.encode(json_string);
      
      //Envia a cola
      channel.sendToQueue(_queue, Buffer.from(json_byteArray), {
          persistent: true
      });
      console.log(" [x] Se envio a la cola '%s' el json '%s'", _queue,json_string );
      });
  });
}


