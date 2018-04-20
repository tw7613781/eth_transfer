import * as Web3 from "web3"
import { BigNumber } from 'bignumber.js'
import https = require("https")
import { dbConfig } from './dbConfig'
import * as mysql from "mysql"


let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

let db = mysql.createConnection(dbConfig);

let txInsertCount = 0
function insertTx(txid: string, address: string, amount: BigNumber | Number, time: Date) {
    let sql = "INSERT INTO `input_transactions` (`tx_hash`, `address`, `tx_amount`, `flag`,`time`) VALUES (?,?,?,?,?);"
    db.query(sql, [txid, address, amount.toString(), "eth", time], (error, results, fields) => {
        if (error) {
            console.log(`Failed to insert TXID ${txid}, ${address}, ${amount}: ${error}`)
        } else {
            // console.log(`Insert TXID ${txid}: ${address}, ${amount}`)
            txInsertCount++
        }
    })
}

function insertCoinPrices(coins: Coin[]): void {
    if (coins.length != 3) {
        throw new Error("Incorrect data or data format")
    }

    let sql = "INSERT INTO `spot_rates` (`bitcoin`,`ethereum`,`litecoin`) VALUES (?,?,?);"
    db.query(sql, [coins[0].price_usd, coins[1].price_usd, coins[2].price_usd], (error, results, fields) => {
        if (error) {
            console.log(`Failed to insert Spot Rate at ${coins[0].time_stamp} values: ${coins[0].price_usd}, ${coins[1].price_usd}, ${coins[2].price_usd}`)
        }
    })

}

let addresses: Map<string,number>
async function getAddresses() {
    addresses = new Map()
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
    let addrCount:number = 0
    for (let result of results) {
        console.log(result)
        let address: string = result.address_eth
        if (!address) {
            console.log(`Skipping`)
            continue
        }
        addresses.set(address.toLowerCase(),addrCount)
        addrCount++
    }
    
    console.log(`Got ${addresses.size} addresses from the database`)
    return Promise.resolve()
}

async function checkForAddressChanges() {
    let sql = "SELECT count(`address_eth`) as count FROM `ico_addresses`;"
    let count: number = await new Promise<number>((resolve, reject) => {
        db.query(sql, [], (error, results, fields) => {
            if (error) {
                console.log("Could not get row count from ico_addresses")
                console.log(error)
                reject(error)
            }
            resolve(results[0].count)
        })
    })

    if (count != addresses.size) {
        console.log(`DB has ${count} address, List has ${addresses.size}`)
        getAddresses();
    }
}

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
    setImmediate(fetchCoinPrices)
    setInterval(() => checkForAddressChanges(), 5000)
    setInterval(() => web3.eth.getBlockNumber(blockPoll), 1000)
    setInterval(() => fetchCoinPrices(), 60000)
    setInterval(()=> reConnect(),60000)
    // web3.eth.getSyncing(printSync)
}

//to track whether lastBlackNumber has changed, if not, re
let pollCount: number = 1
function reConnect(){
    if(pollCount == 0 || !web3.isConnected()){
        web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))
    }
    pollCount = 0
}

let lastBlockNumber: number;// = 5241290 - 5;
let confirmations = 3;
function blockPoll(err: Error, blockNumber: number) {
    pollCount += 1
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
        if (addresses.has(tx.from) || addresses.has(tx.to)) {
            console.log(`TX# ${tx.from} -- ${web3.fromWei(tx.value, 'ether')} --> ${tx.to}`)
            setImmediate(insertTx, tx.hash, tx.to, web3.fromWei(tx.value, 'ether'), new Date(block.timestamp * 1000))
        }
    }
}

let printTimerId: NodeJS.Timer;
function printSync(err: Error, res: Web3.SyncingResult) {
    if (err) {
        console.log(err)
        clearInterval(printTimerId)
    }
    if (res === false) {
        console.log(`Sync complete`)
        clearInterval(printTimerId)
    } else {
        if (printTimerId === undefined) {
            setInterval(() => web3.eth.getSyncing(printSync), 1000)
        }
        console.log(`Sync: ${res.currentBlock} / ${res.highestBlock} (${100 * res.currentBlock / res.highestBlock}%)`)
    }
}


type Coin = {
    id: string
    name: string
    price_usd: number
    time_stamp: number
}

const api_route = "api.coinmarketcap.com"
function fetchCoinPrices() {
    https.get({ host: api_route, path: "/v1/ticker/?limit=10", agent: false }, (res) => {
        let data = ""

        res.on("data", (chunk) => {
            data += chunk
        })

        res.on("end", () => {
            let coins: Coin[] = []
            for (let coin of JSON.parse(data)) {
                if (coin.id == 'bitcoin' || coin.id == 'ethereum' || coin.id == 'litecoin') {
                    let timestamp = parseInt(coin.last_updated);
                    let usd = parseFloat(coin.price_usd)
                    coins.push({
                        id: coin.id,
                        name: coin.name,
                        price_usd: usd,
                        time_stamp: timestamp
                    })
                }
            }
            try {
                insertCoinPrices(coins)
            } catch (error) {
                console.log(error)
            }

        })
    })
}



main().catch((e) => {
    console.log(e)
    db.end();
})
