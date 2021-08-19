'use strict'

const express = require('express')
const expressLayouts = require('express-ejs-layouts')
const axios = require('axios')
const path = require('path')
const qr = require('qrcode')
const uuid4 = require('uuid4')
const urljoin = require('url-join')
const fs = require('fs')
const dotenv = require('dotenv')
dotenv.config()

const ANSII_GREEN = '\u001b[32m'
const ANSII_RESET = '\x1b[0m'
const PORT = 4000

const verityUrl = process.env.VERITY_URL // address of Verity Application Service
const domainDid = process.env.DOMAIN_DID // your Domain DID on the multi-tenant Verity Application Service
const xApiKey = process.env.X_API_KEY // REST API key associated with your Domain DID
const webhookUrl = process.env.WEBHOOK_URL // public URL for the webhook endpoint
const credDefId = process.env.CRED_DEF_ID // credential definition that you recieved

// Sends a message to the Verity Application Service via the Verity REST API
async function sendVerityRESTMessage (qualifier, msgFamily, msgFamilyVersion, msgName, message, threadId) {
  // qualifier - either 'BzCbsNYhMrjHiqZDTUASHg' for Aries community protocols or '123456789abcdefghi1234' for Evernym-specific protocols
  // msgFamily - message family (e.g. 'present-proof')
  // msgFamilyVersion - version of the message family (e.g. '1.0')
  // msgName - name of the protocol message to perform (e.g. 'request')
  // message - message to be sent in the body payload
  // threadId - unique identifier of the protocol interaction. The threadId is used to distinguish between simultaenous interactions

  // Add @type and @id fields to the message in the body payload
  // Field @type is dinamycially constructed from the function arguments and added into the message payload
  message['@type'] = `did:sov:${qualifier};spec/${msgFamily}/${msgFamilyVersion}/${msgName}`
  message['@id'] = uuid4()

  if (!threadId) {
    threadId = uuid4()
  }

  // send prepared message to Verity and return Axios request promise
  const url = urljoin(verityUrl, 'api', domainDid, msgFamily, msgFamilyVersion, threadId)
  console.log(`Posting message to ${ANSII_GREEN}${url}${ANSII_RESET}`)
  console.log(`${ANSII_GREEN}${JSON.stringify(message, null, 4)}${ANSII_RESET}`)
  return axios({
    method: 'POST',
    url: url,
    data: message,
    headers: {
      'X-API-key': xApiKey // <-- REST API Key is added in the header
    }
  })
}

// Store a relationship DID for a user that you're currently connecting to
let currentRelationshipDID = null
// Store generated relationship DID
let relationshipDID
// Maps containing promises for the started interactions - threadId is used as the map key
// Update configs
const updateConfigsMap = new Map()
// Conect relationship test sample id to relationship did
const didTestSampeMap = new Map()
// Relationship create
const relCreateMap = new Map()
// Issue Credential
const issueCredentialMap = new Map()
// Proof request
const proofRequestMap = new Map()
// Retrieved User Data Map
// This is a DEMO application, and user Data is stored in-memory
// Once the app stops, all of the data is gone
const userDataMap = new Map()

// Update webhook protocol is synchronous and does not support threadId
// update webhook endpoint on app startup
let webhookResolve
async function initialize () {
  const webhookMessage = {
    comMethod: {
      id: 'webhook',
      type: 2,
      value: webhookUrl,
      packaging: {
        pkgType: 'plain'
      }
    }
  }

  const updateWebhook =
    new Promise(function (resolve, reject) {
      webhookResolve = resolve
      sendVerityRESTMessage('123456789abcdefghi1234', 'configs', '0.6', 'UPDATE_COM_METHOD', webhookMessage)
    })
  await updateWebhook

  // Update configuration
  // Add your logo and lab name here
  const updateConfigMessage = {
    configs: [
      {
        name: 'logoUrl',
        value: 'https://freeiconshop.com/icon/eye-icon-flat/'
      },
      {
        name: 'name',
        value: 'Example Lab'
      }
    ]
  }

  const updateConfigsThreadId = uuid4()
  const updateConfigs =
    new Promise(function (resolve, reject) {
      updateConfigsMap.set(updateConfigsThreadId, resolve)
    })

  await sendVerityRESTMessage('123456789abcdefghi1234', 'update-configs', '0.6', 'update', updateConfigMessage, updateConfigsThreadId)

  await updateConfigs
}
// Create relationship key
async function createRelationshipDid () {
  // Add logo and lab name here
  const relationshipCreateMessage = {}
  const relThreadId = uuid4()
  const relationshipCreate =
    new Promise(function (resolve, reject) {
      relCreateMap.set(relThreadId, resolve)
    })

  await sendVerityRESTMessage('123456789abcdefghi1234', 'relationship', '1.0', 'create', relationshipCreateMessage, relThreadId)
  const relationshipDid = await relationshipCreate
  return relationshipDid
}

// Proof request to identify user
async function requestProof () {
  const relationshipDid = await createRelationshipDid()
  const proofMessage = {
    '~for_relationship': relationshipDid,
    name: 'Travel Pass Id',
    proof_attrs: [
      {
        name: 'givenNames',
        restrictions: [],
        self_attest_allowed: true
      },
      {
        name: 'lastName',
        restrictions: [],
        self_attest_allowed: true
      },
      {
        name: 'number',
        restrictions: [],
        self_attest_allowed: true
      }
    ],
    proof_predicates: [],
    by_invitation: true
  }

  const proofThreadId = uuid4()
  const requestProof =
    new Promise(function (resolve, reject) {
      proofRequestMap.set(relationshipDID, resolve)
    })

  await sendVerityRESTMessage('BzCbsNYhMrjHiqZDTUASHg', 'present-proof', '1.0', 'request', proofMessage, proofThreadId)
  const verificationResult = await requestProof
  if (verificationResult === 'ProofValidated') {
    console.log('Proof is validated!')
  } else {
    console.log('Proof is NOT validated')
  }
}

const app = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(expressLayouts)
app.use(express.static(__dirname + '/public'))

app.get('/', function (req, res) {
  res.render('home')
})

// Connect user data to test sample id
app.get('/user-registration/:id', function (req, res) {
  if (fs.existsSync('./public/images/invitation_qr.png')) {
    fs.unlinkSync('./public/images/invitation_qr.png')
  }
  const did = req.params.id
  const givenNames = userDataMap.get(did).givenNames
  const lastName = userDataMap.get(did).lastName
  const number = userDataMap.get(did).passportNumber
  res.render('userRegistration', { did: did, givenNames: givenNames, lastName: lastName, number: number })
})

app.post('/user-registration/:id', function (req, res) {
  const testSampleId = req.body.test_sample
  const did = req.params.id
  const now = new Date().toISOString()
  didTestSampeMap.set(testSampleId, { did: did, taken_date: now })
  currentRelationshipDID = null
  res.redirect('/')
})
// Send proof request
app.post('/request-proof', async (req, res) => {
  await requestProof()
  res.redirect('/user-registration/' + currentRelationshipDID)
})
// Send test results
app.get('/send-test-results', async (req, res) => {
  res.render('sendTestResults', { testSamplesMap: didTestSampeMap })
})
app.post('/send-test-results', async (req, res) => {
  const now = new Date().toISOString()
  const didAndTime = req.body.test_sample_did
  const values = didAndTime.split(' ')
  const credentialData = {
    takenDate: values[1],
    resultDate: now,
    testMethod: req.body.test_method,
    labName: req.body.lab_name,
    labCode: req.body.lab_code,
    testLanguage: req.body.test_language,
    testType: req.body.test_type,
    testTechnique: req.body.test_technique,
    testFormat: 'Digital',
    testResult: req.body.test_result
  }

  const credentialMessage = {
    '~for_relationship': values[0],
    cred_def_id: credDefId,
    credential_values: credentialData,
    comment: 'COVID-19 Test',
    by_invitation: false,
    auto_issue: true,
    price: 0
  }
  const issueCredThreadId = uuid4()

  const credentialOffer =
    new Promise(function (resolve, reject) {
      issueCredentialMap.set(issueCredThreadId, resolve)
    })

  await sendVerityRESTMessage('BzCbsNYhMrjHiqZDTUASHg', 'issue-credential', '1.0', 'offer', credentialMessage, issueCredThreadId)
  await credentialOffer

  didTestSampeMap.delete(values[2])
  res.redirect('/')
})

// Receive messages on webhook
app.post('/webhook', async (req, res) => {
  const message = req.body
  const threadId = message['~thread'] ? message['~thread'].thid : null
  let retrievedGivenNames
  let retrievedLastName
  let retrievedPassportNumber
  console.log('Got message on the webhook')
  console.log(`${ANSII_GREEN}${JSON.stringify(message, null, 4)}${ANSII_RESET}`)
  res.status(202).send('Accepted')
  // Handle received message differently based on the message type
  switch (message['@type']) {
    case 'did:sov:123456789abcdefghi1234;spec/configs/0.6/COM_METHOD_UPDATED':
      webhookResolve('webhook updated')
      break
    case 'did:sov:123456789abcdefghi1234;spec/update-configs/0.6/status-report':
      updateConfigsMap.get(threadId)('config updated')
      break
    case 'did:sov:123456789abcdefghi1234;spec/relationship/1.0/created':
      relCreateMap.get(threadId)(message.did)
      relationshipDID = message.did
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/request-received':
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/response-sent':
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/trust_ping/1.0/sent-response':
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/sent':
      if (message.msg['credentials~attach']) {
        issueCredentialMap.get(threadId)('credential issued')
      }
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/presentation-result':
      if (currentRelationshipDID === null) {
        currentRelationshipDID = relationshipDID
      }
      proofRequestMap.get(relationshipDID)(message.verification_result)
      if (typeof message.requested_presentation.revealed_attrs.givenNames !== 'undefined') {
        retrievedGivenNames = message.requested_presentation.revealed_attrs.givenNames.value
      } else {
        retrievedGivenNames = message.requested_presentation.self_attested_attrs.givenNames
      }
      if (typeof message.requested_presentation.revealed_attrs.lastName !== 'undefined') {
        retrievedLastName = message.requested_presentation.revealed_attrs.lastName.value
      } else {
        retrievedLastName = message.requested_presentation.self_attested_attrs.lastName
      }
      if (typeof message.requested_presentation.revealed_attrs.number !== 'undefined') {
        retrievedPassportNumber = message.requested_presentation.revealed_attrs.number.value
      } else {
        retrievedPassportNumber = message.requested_presentation.self_attested_attrs.number
      }
      userDataMap.set(currentRelationshipDID, {
        givenNames: retrievedGivenNames,
        lastName: retrievedLastName,
        passportNumber: retrievedPassportNumber
      })
      relationshipDID = null
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/protocol-invitation':
      // generate qr code and save it into file system
      await qr.toFile('public/images/invitation_qr.png', message.shortInviteURL)
      console.log(`Short Invite URL is:\n${ANSII_GREEN}${message.shortInviteURL}${ANSII_RESET}`)
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/problem-report':
      if (message.description.code === 'rejection') {
        console.log('User rejected to share data')
      }
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.0/move-protocol':
      break
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.0/relationship-reused':
      currentRelationshipDID = message.relationship
      break
    default:
      console.log(`Unexpected message type ${message['@type']}`)
  }
})

app.listen(PORT, async () => {
  console.log('Initializing the app...')
  await initialize()
  console.log(`Webhook listening on port ${PORT}`)
  console.log('Demo lab app now available at http://localhost:4000/')
})
