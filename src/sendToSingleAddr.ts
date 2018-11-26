import * as Web3 from "web3"
import { BigNumber } from 'bignumber.js';

const hdkey = require('ethereumjs-wallet/hdkey')
const utils = require("ethereumjs-util")
const etheTx = require('ethereumjs-tx')
const bip39 = require('bip39')
const commandLineArgs = require('command-line-args')

let web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/v0SeUB4VwulOB375S4Ea"));

// mnemonic to generate "from seed"
const fromMEM: string = "xxxxxxx"
// mnemonic to generate "to seed"
const toMEM: string = "xxxxxxxx"
// store "from wallet" (object) from "from mnemonic"
let fromWallets: any[]
// store "to wallet" from " to mnemonic", just need 1 wallet
let toWallet: any
// store "to address"
let toAddress: string
// store all balances 
let balanceTotal: BigNumber = new BigNumber(0)

let lastBlockNumber: number
let confirmations = 12

let pendingTx: Map<string, number>

const optionDefinitions = [
    {name: 'balance', alias:'b', type: Boolean},
    {name: 'transfer', alias:'t', type: Boolean}
]


const options = commandLineArgs(optionDefinitions)

async function main() {

    if (!web3.isConnected()) {
        throw new Error("Could not connect web3");
    }
    console.log(`Connected successfully to '${web3.version.node}'`)

    // generate ETH address indexed [start, end]
    const limit = 10
    const start = 0
    const end = start + limit - 1

    pendingTx = new Map()

    initWallet(fromMEM, start, end, toMEM)

    if(!options.balance && !options.transfer){
        console.log('Please specify operations, -b for balance checking, -t for bulk bransfer')
        process.exit(0)
    }

    // sum up balance at database
    if(options.balance)
    {
        await balanceLoop(fromWallets, start, limit, 0)
    }

    // send balance of each account to a single account
    if(options.transfer){
        await transferLoop(fromWallets, toAddress, start, limit, 0)
    }

    setInterval(() => web3.eth.getBlockNumber(blockPoll), 1000)

    setInterval(() => showPendingTx(), 10000)
}

async function balanceLoop(fromWallets:Array<any>, start: number, limit: number, index: number){
    if(index === limit){
        return
    }
    await requestBalance(fromWallets, start, index)
    setTimeout(()=>balanceLoop(fromWallets, start, limit, index+1), 100)
}
async function transferLoop(fromWallets:Array<any>, toAddress:string, start: number, limit: number, index: number){
    if(index === limit){
        return
    }
    await requestBalanceAndSend(fromWallets, toAddress, start, index)
    setTimeout(()=>transferLoop(fromWallets, toAddress, start, limit, index+1), 5000)
}
function initWallet(fromMEM: string, start: number, end: number, toMEM: string) {
    //'from' wallets
    fromWallets = []
    const fromDeriveRoot = getDeriveRoot(fromMEM)
    console.log(`From Mnemonic: ${fromMEM}`)
    for(let i=start;i<end+1;i++){
        fromWallets.push(fromDeriveRoot.deriveChild(i).getWallet())
        // console.log(`${i}: ${utils.addHexPrefix(fromWallets[i].getAddress().toString('hex'))}`)
    }
    console.log(`Made ${end-start+1} wallets: child[${start} ~ ${end}]`) 
    //'to' wallet 
    //const toMEM = bip39.generateMnemonic()
    const toDeriveRoot = getDeriveRoot(toMEM)
    console.log(`To Mnemonic: ${toMEM}`)
    toWallet = toDeriveRoot.deriveChild(0).getWallet()
    toAddress = utils.addHexPrefix(toWallet.getAddress().toString('hex'))
    console.log(`Made receive wallet: ${toAddress}`)
}

function getDeriveRoot(mnemonic:string){
    const BIP44_PATH = 'm/44\'/60\'/0\'/0';
    let seed = bip39.mnemonicToSeed(mnemonic)
    let hdWallet = hdkey.fromMasterSeed(seed)
    let derivePath = hdWallet.derivePath(BIP44_PATH)
    return derivePath
}

function requestBalance(fromWallets:Array<any>, start: number, index: number) {
    let fromWallet = fromWallets[index]
    let fromAddr = utils.addHexPrefix(fromWallet.getAddress().toString('hex'))

    let balance: BigNumber = web3.eth.getBalance(fromAddr)

    if (!balance.isZero()) {
        balanceTotal = balanceTotal.plus(balance)
    }
    console.log(start+index + ': Address: ' + fromAddr)
    console.log('   Balance: ' + web3.fromWei(balance, 'ether')+ ' ETH')
    const ethTotal = web3.fromWei(balanceTotal, 'ether')
    console.log(`   Tatal Balance: ${ethTotal} ETH`)
}

async function requestBalanceAndSend(fromWallets:Array<any>, toAddress:string, start: number, index: number) {
    let fromWallet = fromWallets[index]
    let fromAddr = utils.addHexPrefix(fromWallet.getAddress().toString('hex'))
        
    let balance: BigNumber = web3.eth.getBalance(fromAddr)

    if (!balance.isZero()) {
        let gasLimit = 21000
        // 1 Gwei
        const gwei = 1000000000;
        // Check current network gasPrice @ https://ethgasstation.info/
        let gasPrice = 60 * gwei;
        let transfer = balance.minus(gasPrice * gasLimit)
        let nonce = web3.eth.getTransactionCount(fromAddr)

        // console.log(`from Addreess is: ${fromAddr}`)
        // console.log(`nonce is: ${nonce}`)
        // console.log(`balance is: ${balance}`)
        // console.log(`transfer amount is: ${transfer}`)
        // console.log(`gasPrice is: ${gasPrice}`)
        // console.log(`gasLimit is : ${gasLimit}`)
        // console.log('0x'+ transfer.toString(16))
        // console.log('0x'+ gasPrice.toString(16))
        // console.log('0x'+ gasLimit.toString(16))

        const txParams = {
            nonce: '0x'+ nonce.toString(16),
            gasPrice: '0x'+ gasPrice.toString(16),
            gasLimit: '0x'+ gasLimit.toString(16),
            to: toAddress,
            value: '0x'+ transfer.toString(16),
            chainId: '0x01'
        }
        const tx = new etheTx(txParams)
        tx.sign(fromWallet.getPrivateKey())
        const serializedTx = tx.serialize()
        console.log(`${start+index}: ${fromAddr} has balance ${web3.fromWei(balance, 'ether')} ETH`)
        console.log(`${start+index}: Raw Tx: 0x${serializedTx.toString('hex')}`)
        
        let hash: string
        try {
            hash = await new Promise<string>((resolve, reject)=>{
                web3.eth.sendRawTransaction('0x'+serializedTx.toString('hex') , (err, hash)=>{
                    if(!err)
                    {                
                        console.log(`${start+index}: Tx successful sent with hash: ${hash}, from ${fromAddr} sent ${web3.fromWei(transfer, 'ether')} ETH to ${toAddress} with gas fee: ${gasPrice/gwei} GWei and gas limit: ${gasLimit}`)
                        resolve(hash)
                    }
                    else{
                        console.log(`${err}`)
                        reject(err)
                    }
                })
            })
            pendingTx.set(hash, start + index)
        } catch (e) {
            console.log(`Tx fail to send: ${e}`)
        }

    }
    else {
        console.log(`${start+index}: ${fromAddr} has no ETH`)
    }
    
}

function blockPoll(err: Error, blockNumber: number) {
    if (err) {
        console.log("Could not get blockHeight");
        return
    }
    if (lastBlockNumber == undefined) {
        lastBlockNumber = blockNumber - (confirmations + 1)
    }
    if (lastBlockNumber + confirmations < blockNumber) {
        lastBlockNumber++
        setImmediate(processBlock, lastBlockNumber)
    }
}

function processBlock(number: number) {
    let block = web3.eth.getBlock(number, true)
    console.log(`Block #${block.number}: ${block.hash} ${block.transactions.length}`)
    for (let tx of block.transactions) {
        if (pendingTx.has(tx.hash)) {
            // console.log(`Tx ${pendingTx.})
            console.log(`Tx: ${pendingTx.get(tx.hash)} - ${tx.hash} 12 block confirmed`)
            pendingTx.delete(tx.hash)
        }
    }
}

function showPendingTx(){
    console.log(`pending tx: ${pendingTx.size}`)
    for (let tx of pendingTx.keys()){
        console.log(`addr: ${pendingTx.get(tx)} - tx hash: ${tx}`)
    }
}

main().catch((e) => {
    console.log(e)
})
