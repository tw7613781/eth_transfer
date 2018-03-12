import { dbConfig } from './dbConfig'
import * as mysql from "mysql"
const { generateMnemonic, EthHdWallet } = require('eth-hd-wallet')
const utils = require("ethereumjs-util")

let db = mysql.createConnection(dbConfig);
/*
ALTER TABLE `infinity`.`whitelist`
ADD COLUMN `address_eth` VARCHAR(255) NULL AFTER `file_valid`;
*/
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

    // let s = "UPDATE `whitelist` SET email_time = CURRENT_TIMESTAMP WHERE email = ?"
    // db.query(s, ["owen.delahoy@gmail.com"], (error, results, fields) => {
    //     if (error) {
    //         console.log(error)
    //     } else {
    //         console.log("Success")
    //     }
    // })

    const mem = "maze ocean slab maximum sleep potato candy antique hammer parrot unable east"//generateMnemonic()
    console.log(mem)
    const wallet = EthHdWallet.fromMnemonic(mem)
    wallet.generateAddresses(2500)
    let address = wallet.generateAddresses()
    console.log(wallet.get)

    let sql = "SELECT * FROM `whitelist`;"
    let results: any[] = await new Promise<any[]>((resolve, reject) => {
        db.query(sql, [], (error, results, fields) => {
            if (error) {
                reject(error)
            }
            resolve(results)
        })
    })
    for (let result of results) {
        let idx = result['idx'];
        setImmediate(addAddress, idx, utils.toChecksumAddress(address[idx]))
    }
    console.log("Complete")

}

function addAddress(idx: number, address: string) {
    let sql = "UPDATE `whitelist` set `address_eth` = ? where `idx` = ?;"
    let q = db.query(sql, [idx, address.toString()], (error, results, fields) => {
        if (error) {
            console.log(`Failed to give address '${address}' to ${idx}: ${error}`)
        } else {
            console.log(`Gave address '${address}' to ${idx}`)
        }
    })
    console.log(q.sql)
}


main().catch((e) => {
    db.end();
})
