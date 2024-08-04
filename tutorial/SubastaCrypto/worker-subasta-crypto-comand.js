var amqp = require('amqplib/callback_api');

//CONFIGURACION RABBITMQ
const _server = 'amqp://localhost';
const _queue_name = "subasta.crypto.command.queue";
const _queue_name_response = "subasta.crypto.response.queue";
const utf8EncodeText = new TextEncoder();

//CONFIGURACION WEB3 Y CONTRATO SimpleAuction
const { Web3 } = require("web3");
const path = require("path");
const fs = require("fs");

const web3 = new Web3("http://127.0.0.1:7545/");
const contractName = "SimpleAuction"; 
const fileName = `${contractName}.sol`;
const contractNameAbi = "./"+contractName + "Abi.json";
const contractNameByteCode = contractName + "Bytecode.bin";
console.log("contractName: ", contractName);

//FIN CONFIGURACION WEB3 Y CONTRATO SimpleAuction

const Command = {
  DEPLOY: "deploy",
  AUCTION_END: "auctionend",
  WITHDRAW: "withdraw",
  BID: "bid"
};

const Estado = {
  PENDIENTE: 1,
  ABIERTA: 2,
  CERRADA: 3,
  COMPLETADA: 4,
  ERROR: -1,
};



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
     
      
      //convertir los datos recibidos a un json
      
      json_request_dto = JSON.parse(msg.content.toString());
        
      try{
        
        if (json_request_dto.command.toString()==="deploy"){
          fnDeployContrato(json_request_dto);
        }
        if (json_request_dto.command.toString()==="bid"){
          fnRealizarOferta(json_request_dto);
        }
        if (json_request_dto.command===Command.AUCTION_END.toString()){
          fnAuctionEnd(json_request_dto);
        }
        if (json_request_dto.command===Command.WITHDRAW.toString()){
          fnWidthDraw(json_request_dto);
        }
      }catch(e){
        console.log("error:",e);
      }
    }, {
    noAck: true
  });
    });
  });



  async function fnAuctionEnd(json_request_dto) {  
     
      const abi = require(contractNameAbi);
      const currentContract = new web3.eth.Contract(abi, json_request_dto.data.subasta.address_contrato);
      currentContract.handleRevert = false;
      
      const receipt = await currentContract.methods.auctionEnd()
        .send({from: json_request_dto.data.address})
        .on('transactionHash', (hash) => {
          console.log('transactionHash:', hash);
        })
        .on('receipt', (receipt) => {
          console.log('Receipt:', receipt);
          // Aquí puedes manejar la respuesta de la transacción si es necesario
          var json_response = {
            "tx_hash":receipt.transactionHash,
            "estado":Estado.CERRADA,
            "id": json_request_dto.id
          }
          var json_dto = {
            data:json_response,
            command:json_request_dto.command
          }
          
          fnPublicarMensajeMQ(_queue_name_response, json_dto);
        })
        .on('error', (error) => {
          console.error('Error:', error);
          // Manejar cualquier error ocurrido durante la transacción
          var  revertData = '';
          var revertReason = ''; 
          if (error.message.includes('revert')) {
            // La estructura del mensaje de error puede variar. Usualmente, el mensaje de revert está en la propiedad `data` del error.
            var  revertData = error.data ? error.data : error.message;
            var revertReason = revertData.match(/revert (.+)/) ? revertData.match(/revert (.+)/)[1] : 'No se pudo obtener el mensaje de revert';
          }

          var json_response = {
            "tx_hash": "",
            "estado": 3,
            "mensaje": `Error al registrar: ${revertReason}`,
            "id": json_request_dto.data.id
          }
          var json_dto = {
            data:json_response,
            command:json_request_dto.command
          }
          console.log("json_dto: ", json_dto);
          fnPublicarMensajeMQ(_queue_name_response, json_dto);
        });
        
        //consulta de datos luego de la ejecucion de la transaccion
        
        const highestBidder = await currentContract.methods.highestBidder().call();
        console.log("highestBidder: " + highestBidder);
        
        const highestBid = await currentContract.methods.highestBid().call();
        console.log("highestBid: " + highestBid);
        
        //console.log("Transaction Receipt: ", receipt);
        console.log("Transaction Hash: " + receipt.transactionHash);
  
      // Get the updated value of my number
      
    
  }

  //METODO WITHDRAW
  async function fnWidthDraw(json_request_dto) { 
    
      const abi = require(contractNameAbi);
      const currentContract = new web3.eth.Contract(abi, json_request_dto.data.subasta.address_contrato);
      currentContract.handleRevert = true;
      
      const receipt = await currentContract.methods.withdraw()
        .send({
          from: json_request_dto.data.address
        })
        .on('transactionHash', (hash) => {
          console.log('Transaction hash:', hash);   
        })
        .on('receipt', (receipt) => {
          console.log('Receipt:', receipt);
          // Aquí puedes manejar la respuesta de la transacción si es necesario
          var json_response = {
            "tx_hash":receipt.transactionHash,
            "estado":Estado.COMPLETADA,
            "id": json_request_dto.data.id,
            "mensaje":"Completada se realizo withdraw correctamente."
          }
          var json_dto = {
            data:json_response,
            command:json_request_dto.command
          }
          console.log("json_dto: ", json_dto);
          fnPublicarMensajeMQ(_queue_name_response, json_dto);
        })
        .on('error', (error) => {
          console.error('Error:', error);
          // Manejar cualquier error ocurrido durante la transacción
          var json_response = {
            "tx_hash":"",
            "estado":Estado.ERROR,
            "mensaje":"Error al registrar,  se revirto la transaccion.",
            "id": json_request_dto.data.id,
          }
          var json_dto = {
            data:json_response,
            command:json_request_dto.command
          }
         
          fnPublicarMensajeMQ(_queue_name_response, json_dto);
        });
        
        //consulta de datos luego de la ejecucion de la transaccion
        
        const highestBidder = await currentContract.methods.highestBidder().call();
        console.log("highestBidder: " + highestBidder);
        
        const highestBid = await currentContract.methods.highestBid().call();
        console.log("highestBid: " + highestBid);
        
        //console.log("Transaction Receipt: ", receipt);
        console.log("Transaction Hash: " + receipt.transactionHash);
  
      // Get the updated value of my number
      
    
  }

  //METODO DEPLOY CONTRACT
  async function fnDeployContrato(request ) {
    try {
      const bytecodePath = path.join(__dirname, contractNameByteCode);
      const bytecode = fs.readFileSync(bytecodePath, "utf8");
      const abi = require("./"+contractNameAbi);
      const currentContract = new web3.eth.Contract(abi);
      currentContract.handleRevert = true;
  
      const deployerAccount = request.data.address_beneficiario;//providersAccounts[0];
      console.log("Deployer account:", deployerAccount);
      const biddingTime = request.data.duracion;
      const beneficiaryAddress = request.data.address_beneficiario;
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
        var json_response = {
          "id":request.data.id,
          "address_contrato": receipt.contractAddress,
          "estado":2,
          "tx_hash":receipt.transactionHash,
          "mensaje":"subasata generada correctamente"
        }
        var json_dto = {
          data:json_response,
          command:request.command
        }
        
        fnPublicarMensajeMQ(_queue_name_response,json_dto);
  
      })
      .on('error', function(error){
        console.error('Error al desplegar el contrato:', error);
        console.error(error);
        var json_response = {
          "id":request.data.id,
          "address_contrato": "",
          "estado":3,
          "tx_hash":"",
          "mensaje":"error: "+error
        }
        var json_dto = {
          data:json_response,
          command:request.command
        }
        console.log("json_dto: ", json_dto);
        fnPublicarMensajeMQ(_queue_name_response, json_dto);

      });
    } catch (error) {
      console.error(error);
      var json_response = {
        "id":request.data.id,
        "address_contrato": "",
        "estado":Estado.ERROR,
        "tx_hash":"",
        "mensaje":"error: "+error
      }
      var json_dto = {
        data:json_response,
        command:json_request_dto.command
      }
      console.log("json_dto: ", json_dto);
      fnPublicarMensajeMQ(_queue_name_response, json_dto);
    }
  }


async function fnRealizarOferta(json_request_dto) {  
 
    // Create a new contract object using the ABI and address    
    const abi = require(contractNameAbi);
    const currentContract = new web3.eth.Contract(abi, json_request_dto.data.subasta.address_contrato);
    currentContract.handleRevert = true;
    const bidAmount = BigInt(parseFloat(json_request_dto.data.importe) * 10 ** 18);;
  
    const receipt = await currentContract.methods.bid()
      .send({ from: json_request_dto.data.address, value: bidAmount })
      .on('transactionHash', (hash) => {
        console.log('Transaction hash:', hash);
       
      })
      .on('receipt', (receipt) => {
        console.log('Receipt:', receipt);
        // Aquí puedes manejar la respuesta de la transacción si es necesario
        var json_response = {
          "tx_hash":receipt.transactionHash,
          "estado":2,
          "mensaje":"oferta generada correctamente",
          "id": json_request_dto.data.id
        }
        var json_dto = {
          data:json_response,
          command:json_request_dto.command
        }
        console.log("json_dto: ", json_dto);
        fnPublicarMensajeMQ(_queue_name_response, json_dto);

      })
      .on('error', (error) => {
        console.error('Error:', error);
        // Manejar cualquier error ocurrido durante la transacción
        var json_response = {
          "tx_hash":"",
          "estado":3,
          "mensaje":"Error al registrar,  se revirto la transaccion.",
          "id": json_request_dto.data.id
        }
        var json_dto = {
          data:json_response,
          command:json_request_dto.command
        }
        console.log("json_dto: ", json_dto);
        fnPublicarMensajeMQ(_queue_name_response, json_dto);
      });
      
      //consulta de datos luego de la ejecucion de la transaccion
      
      const highestBidder = await currentContract.methods.highestBidder().call();
      console.log("highestBidder: " + highestBidder);
      
      const highestBid = await currentContract.methods.highestBid().call();
      console.log("highestBid: " + highestBid);
      
      //console.log("Transaction Receipt: ", receipt);
      console.log("Transaction Hash: " + receipt.transactionHash);

    // Get the updated value of my number
    
  
}


/*
  PUBLICAR MENSAJE EN RABBIT
*/
async function fnPublicarMensajeMQ(_queue, _json){
  console.log("NUEVO MENSAJE: ", _queue, _json);
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