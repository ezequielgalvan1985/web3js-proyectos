import { Web3 } from 'web3';

const web3 = new Web3('HTTP://127.0.0.1:7545'); 


web3.eth.getBlockNumber().then(console.log);
// get the balance of an address
var result = await web3.eth.getBalance('0x8bAC007De6122E7843C47859d981Fa94f8c9104E');
console.log("Balance:", result);

await web3.eth.getBlockNumber();

// get the chain id of the current provider
var r = await web3.eth.getChainId();
console.log("getChainId:", r);

var r = await web3.eth.getTransactionCount('0x8bAC007De6122E7843C47859d981Fa94f8c9104E');
console.log("getTransactionCount:", r);

var r = await web3.eth.getGasPrice();
console.log("getGasPrice:", r);

/*
// create random wallet with 1 account
var r = web3.eth.accounts.wallet.create(1)
console.log(r);

Wallet(1) [
  {
    address: '0x84c6e017110b6Cdb099B513a4C52A19F0563b214',
    privateKey: '0x1c380c6abe3b71e1e1c3956bfee46eac2e1223142f07f485133f3c88bdb0a960',
    signTransaction: [Function: signTransaction],
    sign: [Function: sign],
    encrypt: [Function: encrypt]
  },
  _accountProvider: {
    create: [Function: createWithContext],
    privateKeyToAccount: [Function: privateKeyToAccountWithContext],
    decrypt: [Function: decryptWithContext]
  },
  _addressMap: Map(1) { '0x84c6e017110b6cdb099b513a4c52a19f0563b214' => 0 },
  _defaultKeyName: 'web3js_wallet'
]
*/

const account = web3.eth.accounts.wallet.add('0xb46ed866ea64ce425edbc433424b895699c25e80c2cf7f481d667c43bf5e06f9');

console.log("address: ",account[0].address);

console.log("private key: ",account[0].privateKey);


// create transaction object to send 1 eth to '0xa32...c94' address from the account[0]
const tx = 
{ 
    from: account[0].address,
    to: '0x5612716668231290016C2dd88933a6acc7A6D1c3', 
    value: web3.utils.toWei('1', 'ether')
};
// the "from" address must match the one previously added with wallet.add

// send the transaction
const txReceipt = await web3.eth.sendTransaction(tx);

console.log('Tx hash:', txReceipt.transactionHash)
