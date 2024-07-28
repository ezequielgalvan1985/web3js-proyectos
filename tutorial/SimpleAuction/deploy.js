const { Web3 } = require("web3");
const path = require("path");
const fs = require("fs");

const web3 = new Web3("http://127.0.0.1:7545/");

const contractName = process.argv[2]; 

const fileName = `${contractName}.sol`;
console.log("contractName: ", contractName);

const contractNameByteCode = contractName + "Bytecode.bin";
const contractNameAbi = contractName + "Abi.json";
const contractAddressFileName = contractName + "Address.txt"; 

const bytecodePath = path.join(__dirname, contractNameByteCode);
const bytecode = fs.readFileSync(bytecodePath, "utf8");

const abi = require("./"+contractNameAbi);
const myContract = new web3.eth.Contract(abi);
myContract.handleRevert = true;

async function deploy() {
  const providersAccounts = await web3.eth.getAccounts();
  const defaultAccount = providersAccounts[0];
  console.log("Deployer account:", defaultAccount);


  const biddingTime = 6000;
  const beneficiaryAddress = "0xa895FEC9BA786b949949f0F0d3Efb8504E89104B";
  const contractDeployer = myContract.deploy({
    data: "0x" + bytecode,
    arguments: [biddingTime, beneficiaryAddress],
  });

  const gas = await contractDeployer.estimateGas({
    from: defaultAccount,
  });
  console.log("Estimated gas:", gas);

  try {
    const tx = await contractDeployer.send({
      from: defaultAccount,
      gas,
      gasPrice: 10000000000,
    });
    console.log("Contract deployed at address: " + tx.options.address);

    const deployedAddressPath = path.join(__dirname, contractAddressFileName);
    fs.writeFileSync(deployedAddressPath, tx.options.address);
  } catch (error) {
    console.error(error);
  }
}

deploy();