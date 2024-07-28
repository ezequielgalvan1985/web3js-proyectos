const { Web3 } = require("web3");
const path = require("path");
const fs = require("fs");

const web3 = new Web3("http://127.0.0.1:7545/");

const contractName = process.argv[2]; 
const contractNameByteCode = contractName + "Bytecode.bin";
const contractNameAbi = "./"+contractName + "Abi.json";
const contractAddressFileName = contractName + "Address.txt"; 


// Read the contract address from the file system
const deployedAddressPath = path.join(__dirname, contractAddressFileName);
const deployedAddress = fs.readFileSync(deployedAddressPath, "utf8");

console.log("deployedAddress: ",deployedAddress)
console.log("contractNameAbi: ",contractNameAbi);
console.log("contractAddressFileName: ",contractAddressFileName);

// Create a new contract object using the ABI and address
const abi = require(contractNameAbi);
const currentContract = new web3.eth.Contract(abi, deployedAddress);
currentContract.handleRevert = true;



async function realizarOferta() {
  const accounts = await web3.eth.getAccounts();
  const defaultAccount = "0xC9060C7aCAAa0B8858eD9D2898fC7D7c96bCf7e8";
  const bidAmount = web3.utils.toWei('0.23', 'ether');

  try {
    // Get the current value of my number
    const receipt = await currentContract.methods.bid()
      .send({ from: defaultAccount, value: bidAmount })
      .on('transactionHash', (hash) => {
        console.log('Transaction hash:', hash);
      })
      .on('receipt', (receipt) => {
        console.log('Receipt:', receipt);
        // Aquí puedes manejar la respuesta de la transacción si es necesario
      })
      .on('error', (error) => {
        console.error('Error:', error);
        // Manejar cualquier error ocurrido durante la transacción
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
  }
}

// realizarOferta();

async function consultaGeneral() {
  const highestBidder = await currentContract.methods.highestBidder().call();
  console.log("highestBidder: " + highestBidder);
  
  const highestBid = await currentContract.methods.highestBid().call();
  console.log("highestBid: " + highestBid);

  const ended = await currentContract.methods.auctionEnd().call();
  console.log("auctionEnd: " + ended);

}
realizarOferta();
consultaGeneral();
