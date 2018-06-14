import { dbConfig } from './dbConfig'
import * as mysql from "mysql"
import * as Web3 from "web3"
import { BigNumber } from 'bignumber.js';

const hdkey = require('ethereumjs-wallet/hdkey')
const utils = require("ethereumjs-util")
const etheTx = require('ethereumjs-tx')
const bip39 = require('bip39')

let db = mysql.createConnection(dbConfig);
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
// iterate each address or wallet
let count:number
// mnemonic to generate from seed
const fromMEM: string = "maze ocean slab maximum sleep potato candy antique hammer parrot unable east"
// mnemonic to generate to seed
const toMEM: string = "people volume drive live mesh shrug message pudding rain snow hip cloth"
// store addresses from db
let addresses: string[]
// store "from wallet" (object) from "from mnemonic"
let fromWallets: any[]
// store "to wallet" from " to mnemonic", just need 1 wallet
let toWallet: any
// store "to address"
let toAddress: string
// store all balances 
let balanceTotal: BigNumber = new BigNumber(0)

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
    
    initWallet(fromMEM, toMEM)

    //sum up balance at database
    count = 0
    timerId = setInterval(() => {
        requestBalance(addresses, fromWallets)
    }, 500)

    // // send balance of each account to a single account
    // count = 0
    // timerId = setInterval(() => {
    //     requestBalanceAndSend(addresses, fromWallets, toAddress)
    // }, 5000)
}


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
    // let addrCount=0
    for (let result of results) {
        let address: string = result.address_eth.toLowerCase()
        if (!address) {
            console.log(`Skipping`)
            continue
        }
        addresses.push(address)
        // console.log(`${addrCount}: ${address}`)
        // addrCount++
    }
    console.log(`Got ${addresses.length} addresses from the database`)
    return Promise.resolve()
}

function initWallet(fromMEM: string, toMEM: string) {
    //'from' wallets
    fromWallets = []
    const fromDeriveRoot = getDeriveRoot(fromMEM)
    let i
    for(i=0;i<addresses.length;i++){
        fromWallets.push(fromDeriveRoot.deriveChild(i).getWallet())
        // console.log(`${i}: ${utils.addHexPrefix(fromWallets[i].getAddress().toString('hex'))}`)
    }
    console.log(`made ${i} wallets`) 
    //'to' wallet 
    //const toMEM = bip39.generateMnemonic()
    const toDeriveRoot = getDeriveRoot(toMEM)
    toWallet = toDeriveRoot.deriveChild(0).getWallet()
    toAddress = utils.addHexPrefix(toWallet.getAddress().toString('hex'))
    console.log(`made receive wallet: ${toAddress}`)
}

function getDeriveRoot(mnemonic:string){
    const BIP44_PATH = 'm/44\'/60\'/0\'/0';
    let seed = bip39.mnemonicToSeed(mnemonic)
    let hdWallet = hdkey.fromMasterSeed(seed)
    let derivePath = hdWallet.derivePath(BIP44_PATH)
    return derivePath
}

function requestBalance(addresses:Array<string>, fromWallets:Array<any>) {
    let fromAddr = addresses[count]
    let fromWallet = fromWallets[count]
    //validation
    if(utils.addHexPrefix(fromWallet.getAddress().toString('hex')) == fromAddr)
    {
        //console.log(`${count}: we are same`)
        let balance: BigNumber = web3.eth.getBalance(fromAddr)

        if (!balance.isZero()) {
            balanceTotal = balanceTotal.plus(balance)
        }
        console.log('Address: ' + fromAddr)
        console.log('Balance: ' + balance)
        console.log(`Tatal Balance: ${balanceTotal} Wei`)
        const ethTotal = web3.fromWei(balanceTotal, 'ether')
        console.log(`Tatal Balance: ${ethTotal} eth`)
    }
    else{
        console.log(count+': the from wallet address is not match with address got from Database~~, the address at DB has been modified')
        console.log('Please check~~')   
        //4025 has been changed
    }
    count++
    if (count == addresses.length) {
        console.log('Done')
        clearInterval(timerId)
    }
}

function requestBalanceAndSend(addresses:Array<string>, fromWallets:Array<any>, toAddress:string) {
    let fromAddr = addresses[count]
    let fromWallet = fromWallets[count]
    //validation
    if(utils.addHexPrefix(fromWallet.getAddress().toString('hex')) == fromAddr)
    {
        //console.log(`${count}: we are same`)
        let balance: BigNumber = web3.eth.getBalance(fromAddr)

        if (!balance.isZero()) {
            let gasLimit = 21000
            // 1 Gwei
            const gwei = 1000000000;
            let gasPrice = 1 * gwei;
            let transfer = balance.minus(gasPrice * gasLimit)
            let nonce = web3.eth.getTransactionCount(fromAddr)
    
            // console.log(`from Addreess is: ${fromAddr}`)
            // console.log(`nonce is: ${nonce}`)
            // console.log(`balance is: ${balance}`)
            // console.log(`transfer amount is: ${transfer}`)
            // console.log(`gasPrice is: ${gasPrice}`)
            // console.log(`gasLimit is : ${gasLimit}`)
            // console.log('0x'+ (nonce + 1).toString(16))
            // console.log('0x'+ transfer.toString(16))
            // console.log('0x'+ gasPrice.toString(16))
            // console.log('0x'+ gasLimit.toString(16))

            const txParams = {
                nonce: '0x'+ nonce.toString(16),
                //nonce: '0x'+ (nonce + 1).toString(16),
                gasPrice: '0x'+ gasPrice.toString(16),
                gasLimit: '0x'+ gasLimit.toString(16),
                to: toAddress,
                value: '0x'+ transfer.toString(16),
                chainId: '0x01'
            }
            const tx = new etheTx(txParams)
            tx.sign(fromWallet.getPrivateKey())
            const serializedTx = tx.serialize()
            console.log(`${count}: ${fromAddr} has balance ${balance.toNumber()} Wei`)
            console.log(`${count}: Raw Tx: 0x${serializedTx.toString('hex')}`)
            
            web3.eth.sendRawTransaction('0x'+serializedTx.toString('hex') , (err, hash)=>{
                if(!err)
                {                
                    console.log(`Tx hash is: ${hash}, from ${fromAddr} sent ${transfer} Wei to ${toAddress} with gas fee: ${gasPrice} Wei and gas limit: ${gasLimit}`)
                }
                else{
                    console.log(`${err}`)
                }
            })
      }
        else {
            console.log(`${count}: ${fromAddr} has no Ether`)
        }
    }
    else{
        console.log(count+': the from wallet address is not match with address got from Database~~, the address at DB has been modified')
        console.log('Please check~~')   
        //4025 has been changed
    }
    count++
    if (count == addresses.length) {
        console.log('Done')
        clearInterval(timerId)
    }
}

main().catch((e) => {
    console.log(e)
    db.end();
})
