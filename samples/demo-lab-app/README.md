## Verity Sample Lab App

This is a sample application that demonstrates Lab App API integration.
>DISCLAIMER: This is a sample application, and it isn't meant to be used in production. There are some disadvantages like ngrok tunnels that time out, and in-memory storage that stores user data only while this app is up and running. 

### Launching the application Locally

Requirements:
- You have received Domain DID, REST API key and Credential Definition Id from Evernym
- You have NodeJs v12 or later installed
- You have ngrok installed ([https://ngrok.com/](https://ngrok.com/)).
> NOTE: Ngrok is used to create a public webhook URL which will forward response messages from Verity Application Server to the web app. If you have capabilities to start the application on a public IP address then you don't need ngrok]

To try out the application follow these steps:

- In a separate terminal window start ngrok for port 4000 and leave it running:
```sh
ngrok http 4000
```
- Install required NodeJs packages:
```sh
npm install
```
- Start the app
```sh
node app.js
```

- Fill in values for VERITY_URL, DOMAIN_DID, X_API_KEY (you should have received these inputs from Evernym), and WEBHOOK_URL into **.env** file in the current folder. A properly filled **.env** file should have this format:
```sh
VERITY_URL=https://vas.pps.evernym.com
DOMAIN_DID=RvhfGuPU86SqgNzFKaK8ou
X_API_KEY=3VB7DfTwDptvWusaQeL3sEbdbtbDskceLcLk3m3Xrw7e:2ijiJEpbYkERCcJUGSfX2wjsX22WTzhJXBmqqm8e35FWZ4fjyLMBfVE92mYJJ72CUUTRg4ZT2LxFHTzGntembzjK
CRED_DEF_ID=282aNwH4oHuqq3rg911TVB:3:CL:179684:latest
WEBHOOK_URL=https://2cdfa95b3ed5.ngrok.io/webhook
```
> NOTE: These are just sample reference values. These values will NOT work if left unchanged. You should specify DOMAIN_DID, X_API_KEY and CRED_DEF_ID that you received from Evernym

The application will be available on http://localhost:4000

### Launching the application using Docker

Requirements:
- You have received Domain DID, REST API key and Credential Definition Id from Evernym
- You have Docker installed

To start the app follow these steps:
- Fill in values for VERITY_URL, DOMAIN_DID and X_API_KEY (you should have received these inputs from Evernym) into **.env** file in the current folder. A properly filled **.env** file should have this format:
```sh
VERITY_URL=https://vas.pps.evernym.com
DOMAIN_DID=RvhfGuPU86SqgNzFKaK8ou
X_API_KEY=3VB7DfTwDptvWusaQeL3sEbdbtbDskceLcLk3m3Xrw7e:2ijiJEpbYkERCcJUGSfX2wjsX22WTzhJXBmqqm8e35FWZ4fjyLMBfVE92mYJJ72CUUTRg4ZT2LxFHTzGntembzjK
CRED_DEF_ID=282aNwH4oHuqq3rg911TVB:3:CL:179684:latest
```
> NOTE: These are just sample reference values. These values will NOT work if left unchanged. You should specify DOMAIN_DID, X_API_KEY and CRED_DEF_ID that you received from Evernym
- Create a docker image with pre-installed requirements. Run this command from the current folder:
```sh
docker build -t demo-lab-app .
```
Start a Docker container:
```sh
docker run -p 4000:4000 --env-file .env -it demo-lab-app
```

The application will be available on http://localhost:4000

© 2013-2021, ALL RIGHTS RESERVED, EVERNYM INC.