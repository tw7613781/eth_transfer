import { dbConfig } from './dbConfig'
import * as mysql from "mysql"
const { generateMnemonic, EthHdWallet } = require('eth-hd-wallet')
const utils = require("ethereumjs-util")
import * as Web3 from "web3"
import { BigNumber } from 'bignumber.js';

let db = mysql.createConnection(dbConfig);
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let toMem = "people volume drive live mesh shrug message pudding rain snow hip cloth"
let toWallet = EthHdWallet.fromMnemonic(toMem)
let sendMem = "maze ocean slab maximum sleep potato candy antique hammer parrot unable east"
let sendWallet = EthHdWallet.fromMnemonic(sendMem)
let timerId: NodeJS.Timer

async function main() {
    await new Promise((resolve, reject) => {
        db.connect((err) => {
            if (err) {
                reject(err)
            } else {
                console.log(`Connected to db, id: '${db.threadId}'`)
                resolve()
            }
        })
    })

    if (!web3.isConnected()) {
        throw new Error("Could not connect web3");
    }
    console.log(`Connected successfully to '${web3.version.node}'`)

    await getAddresses()

    // const mem = generateMnemonic()
    let toAddr = toWallet.generateAddresses(1)[0]
    //initialize send wallet
    sendWallet.generateAddresses(addresses.length)
    console.log(`ToAddress is: ${toAddr}`)
    //0xb4f4945a5af3472e5e7b0abdfbcdce5d54eb2a1b

    timerId = setInterval(()=>{
        requestBalanceAndSend(toAddr)
    }, 1000)
}

let addresses: string[]
async function getAddresses() {
    addresses = []
    let sql = "SELECT `address_eth` FROM `ico_addresses`;"
    let results: any[] = await new Promise<any[]>((resolve, reject) => {
        db.query(sql, [], (error, results, fields) => {
            if (error) {
                console.log("Could not get addresses from whitelist")
                console.log(error)
                reject(error)
            }
            resolve(results)
        })
    })
    for (let result of results) {
        let address: string = result.address_eth.toLowerCase()
        if (!address) {
            console.log(`Skipping`)
            continue
        }
        addresses.push(address)
        console.log(address)
    }
    console.log(`Got ${addresses.length} addresses from the database`)
    return Promise.resolve()
}

let count = 0
function requestBalanceAndSend(toAddr:string){
    let fromAddr = addresses[count]
    let balance:BigNumber = web3.eth.getBalance(fromAddr)


    if(!balance.isZero()){
        // 21000 Gwei
        let gasLimit = 21000
        // 1 Gwei
        let gas = 1000000000
        let transfer: number = balance.toNumber()-gas-gasLimit*1000000000
        let nonce = web3.eth.getTransactionCount(fromAddr)

        // console.log(nonce)
        // console.log(fromAddr)
        // console.log(balance.toNumber())
        // console.log(transfer)
        // console.log(gasLimit*1000000000)
        // console.log(gas)

        const rawTx = sendWallet.sign({
            nonce: nonce+1, 
            from: fromAddr,
            to: toAddr,
            value: transfer,
            data: '',
            gasLimit: gasLimit,
            gasPrice: gas,
            chainId: 1
        })
        //console.log(rawTx)
        try{
            //let txHash = 7873838
            let txHash = web3.eth.sendRawTransaction(rawTx)
            console.log(`${count}: ${fromAddr} has ${balance.toNumber()} Wei`)
            console.log(`Tx hash is: ${txHash}, from ${fromAddr} sent ${transfer} Wei to ${toAddr} with gas fee: ${gas} Wei and gas limit: ${gasLimit*1000000000}`)
            // Tx hash is: 0xb27717a0808d2de476f867bd49c4d764da8f504f2e4a64ae0486941b229d0446, from 0xbd549e06a01622d0f2315ecbfd4a1ccc8fc334b3 sent 18936999000000000 Wei to 0xb4f4945a5af3472e5e7b0abdfbcdce5d54eb2a1b with gas fee: 1000000000 Wei and gas limit: 21000000000000
        }catch(e){
            console.log(e)
        }
    }
    else{
        console.log(`${count}: ${fromAddr} has no Ether`)
    }
    count++
    if(count == addresses.length){
        console.log('Done')
        clearInterval(timerId)
    }
}

main().catch((e) => {
    console.log(e)
    // db.end();
})
