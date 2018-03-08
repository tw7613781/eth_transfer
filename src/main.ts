import web3;

var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

if (!web3.isConnected()) {
    throw new Error("Could not connect");
}

console.log(`Connected successfully to '${web3.version.node}'`)

web3.fil