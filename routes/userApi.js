const express = require("express");
const Moralis = require("moralis").default;
const { EvmChain } = require("@moralisweb3/common-evm-utils");
const { ethers } = require("ethers");
const sql = require("mssql")
const contractData = require('../assets/abi.json');
const maqWithdrawalcontractData = require('../assets/maqWithdrawalContractAbi.json');
const jwt = require('jsonwebtoken');
const ADMIN_WALLET = "0x21Dd8086461A9BE3013FD6c425765da13Be0E8A8";
const USDT_ADDRESS = "0x481694ee8EF4f2a516B1Ca7f54b78a42a9452eab";
const WithdrawalContract = "0x363ff7036e1DF0c52e0A677d6917A54ad035D77f";

// Your secret key (keep it safe!)
const SECRET_KEY = 'maq-codetentacles';

const router = express.Router();
const apiKey = process.env.API_KEY;
const webhookUrl = process.env.WEBHOOK_URL;

// connect sql start
const config = {
  user: 'MAQ',
  password: 'maq@54321',
  server: '43.231.127.206', // Usually 'localhost' if SQL Server is running on the same machine as Node.js
  database: 'MAQDb',
  options: {
    trustedConnection: true, // Use this option for Windows authentication (omit if using username/password)
    encrypt: true, // For security reasons, set to true if SQL Server uses encrypted connections
    trustServerCertificate: true,
  },
};


async function connectToSqlServer() {
  try {
    await sql.connect(config);
    console.log('Connected to SQL Server');
  } catch (err) {
    console.error('Error connecting to SQL Server:', err);
  }
}

// connect sql end


// server related tasks start

async function generateWallet(email) {
  try {
    const checkUserQuery = `
      select count(*) as counts from Users
      WHERE email = @emailId;
    `;
    const requestCheckUser = new sql.Request();
    requestCheckUser.input('emailId', sql.NVarChar(100), email);
    const resultCheckUser = await requestCheckUser.query(checkUserQuery);

    if (resultCheckUser.recordset[0].counts > 0) {
         // start the moralis server 
        const data = await ganerateAndAddToStream();
        const token = jwt.sign(data.walletInfo.privateKey, SECRET_KEY);

        const newWalletAddress = data.walletInfo.address;
        const query = `
        UPDATE Users
        SET walletAddress = @newWalletAddress,
        PrivateKey = @token
        WHERE email = @emailId
        `;
        const request = new sql.Request();
        request.input('newWalletAddress', sql.NVarChar(100), newWalletAddress);
        request.input('emailId', sql.NVarChar(100), email);
        request.input('token', sql.NVarChar(100), token);

        const result = await request.query(query);
        
        return {
          status : true,
          message : "New wallet address added"
        }
    }
    else{
      return {
        status : false,
        message : "User not exists"
      }
    }




  } catch (err) {
    console.error('Error executing query:', err);
  }
}


async function closeConnection() {
  try {
    await sql.close();
    console.log('Connection closed');
  } catch (err) {
    console.error('Error closing connection:', err);
  }
}

// server related tasks end


// create a moralis stream start
const postData = async () => {
  console.log("Hello post")

  const stream = {
    chains: [EvmChain.ETHEREUM, EvmChain.POLYGON], // list of blockchains to monitor
    description: "monitor BobTags wallet 4", // your description
    tag: "stream03", // give it a tag
    webhookUrl: webhookUrl, // webhook url to receive events,
    includeNativeTxs: true,
  };

  const newStream = await Moralis.Streams.add(stream);
  return newStream
}
// create a moralis stream end


Moralis.start({
  apiKey: apiKey,
});



const generateWalletAddress = async () => {

  // const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  // const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // const factory = new ethers.ContractFactory(contractData.abi, contractData.bytecode, wallet);

  // const contract = await factory.deploy();  // Add constructor arguments if needed
  // console.log('Contract deploying to:', contract.target);
  
  // await contract.waitForDeployment()
  // console.log('Contract deployed at:', contract.address);

  // Return the private key and address as an object
  // return { privateKey:"", address : contract.target };


  // Generate a random wallet using ethers.Wallet.createRandom()
  const wallet = ethers.Wallet.createRandom();

  const privateKey = wallet.privateKey;
  const address = wallet.address;

  // Return the private key and address as an object
  return { privateKey, address };

}

const ganerateAndAddToStream = async () => {
  const walletInfo = await generateWalletAddress();

  const dataToShare = await Moralis.Streams.addAddress({ address: walletInfo.address, id: "95a979ef-871b-47a2-a6ff-4539dd639625" });

  return { dataToShare, walletInfo };
};

router.get("/walletCreation/:email", async (req, res) => {
  try {


    console.log(req.params.email)
    let email = req.params.email

    // server related task start
    await connectToSqlServer();

    const response = await generateWallet(email);

    await closeConnection()
    // server related task end
    if(response.status){
      res.status(200).send(response.message)
  }
  else{
    res.status(401).send(response.message)
  }

  } catch (error) {
    console.error(error);
  }
});


router.post("/activation/", async (req, res) => {
    const email = req.body.email;
    // server related task start
    await connectToSqlServer();
    const checkUserQuery = `
      select walletAddress,Privatekey from Users
      WHERE email = @emailId;
    `;
    const requestCheckUser = new sql.Request();
    requestCheckUser.input('emailId', sql.NVarChar(100), email);
    const resultCheckUser = await requestCheckUser.query(checkUserQuery);
    console.log(resultCheckUser.recordset[0].Privatekey);
    if (ethers.isAddress(resultCheckUser.recordset[0].walletAddress)) {
      const walletAddress = resultCheckUser.recordset[0].walletAddress;
      const decoded = jwt.verify(resultCheckUser.recordset[0].Privatekey, SECRET_KEY);
      const pvtKey = decoded;
      transferERC20(walletAddress,pvtKey,amount)
    }
    await closeConnection()
   
});


const transferERC20 = async (walletAddress,pvtKey, amount) => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(pvtKey, provider);
  const contract = new ethers.Contract(USDT_ADDRESS, contractData.abi, provider).connect(wallet);
  const txResponse = await contract.transfer(amount,ADMIN_WALLET);
  const receipt = await txResponse.wait();
  console.log(`Transaction hash: ${receipt}`);
};




router.post("/withdrawal", async (req, res) => {
  const walletAddress = req.body.to;
  const amount = req.body.amount;
  const otp = req.body.uniquecode;
  const signature = req.body.signature;
  if(ethers.isAddress(walletAddress) && amount>0 && otp>0){
    initiateWithdrawal(walletAddress,amount,otp,signature);
  res.status(200).send("Task completed successfully");
  }
  else{
    res.status(401).send("Invalid address");
  }
 
});


const initiateWithdrawal = async (to, amount,uniquecode,signature) => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(WithdrawalContract, maqWithdrawalcontractData.abi, provider).connect(wallet);
  const txResponse = await contract.transferUSTDWithSignature(to,amount,uniquecode,signature);
  const receipt = await txResponse.wait();
  console.log(`Transaction hash: ${receipt}`);
};


// startServer()

module.exports = router;
