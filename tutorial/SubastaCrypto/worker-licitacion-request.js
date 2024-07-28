var amqp = require('amqplib/callback_api');

//CONFIGURACION RABBITMQ
const _server = 'amqp://localhost';
const _queue_name = "licitacion.request.queue";
const utf8EncodeText = new TextEncoder();

//CONFIGURACION WEB3 Y CONTRATO SimpleAuction
const { Web3 } = require("web3");
const path = require("path");
const fs = require("fs");
//FIN CONFIGURACION WEB3 Y CONTRATO SimpleAuction




//1) Escuchar cola licitacion.request.queue 
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
      //fnRealizarOferta(json_request_dto.subasta.address, json_request_dto.address, json_request_dto.importe);
      fnRealizarOferta(json_request_dto);

    }, {
    noAck: true
  });
    });
  });






async function fnRealizarOferta(json_request_dto ) {
  
  try {
    const web3 = new Web3("http://127.0.0.1:7545/");

    const contractName = "SimpleAuction"; 
    const contractNameByteCode = contractName + "Bytecode.bin";
    const contractNameAbi = "./"+contractName + "Abi.json";
    //console.log("_addressContrato: ", _addressContrato)
    //console.log("contractNameAbi: ",contractNameAbi);
    
    // Create a new contract object using the ABI and address    
    const abi = require(contractNameAbi);
    const currentContract = new web3.eth.Contract(abi, json_request_dto.subasta.address);
    currentContract.handleRevert = true;
    const bidAmount = BigInt(parseFloat(json_request_dto.importe) * 10 ** 18);;
  
    const receipt = await currentContract.methods.bid()
      .send({ from: json_request_dto.address, value: bidAmount })
      .on('transactionHash', (hash) => {
        console.log('Transaction hash:', hash);
       
      })
      .on('receipt', (receipt) => {
        console.log('Receipt:', receipt);
        // Aquí puedes manejar la respuesta de la transacción si es necesario
        var json_response = {
          "tx_hash":receipt.transactionHash,
          "estado":2,
          "id": json_request_dto.id
        }
        console.log("json_response: ", json_response);
        //crear un json dto para enviar a cola licitacion.response.queue
        //llamar a funcion 
        fnPublicarMensajeMQ("licitacion.response.queue", json_response);

      })
      .on('error', (error) => {
        console.error('Error:', error);
        // Manejar cualquier error ocurrido durante la transacción
        var json_response = {
          "tx_hash":"",
          "estado":3,
          "mensaje":"Error al registrar,  se revirto la transaccion.",
          "id": json_request_dto.id
        }
        console.log("json_response: ", json_response);
        //crear un json dto para enviar a cola licitacion.response.queue
        //llamar a funcion 
        fnPublicarMensajeMQ("licitacion.response.queue", json_response);

      });
      
      //consulta de datos luego de la ejecucion de la transaccion
      
      const highestBidder = await currentContract.methods.highestBidder().call();
      console.log("highestBidder: " + highestBidder);
      
      const highestBid = await currentContract.methods.highestBid().call();
      console.log("highestBid: " + highestBid);
      
      //console.log("Transaction Receipt: ", receipt);
      console.log("Transaction Hash: " + receipt.transactionHash);

    // Get the updated value of my number
    
  } catch (error) {
    console.error(error);
    var json_response = {
      "tx_hash":"",
      "estado":3,
      "mensaje":"Error con la red,  no se concreto la transaccino.",
      "id": json_request_dto.id
    }
    fnPublicarMensajeMQ("licitacion.response.queue", json_response);

  }
}





async function fnPublicarMensajeMQ(_queue, _json){
  console.log("Se agrega transaccion a ..."+ _queue);
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


