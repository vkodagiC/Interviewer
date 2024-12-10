# ChatGPT based Interviewer

To set up first you need to have node.js installed on your system.
Can be installed using the link - https://nodejs.org/en/download/prebuilt-installer

After Node.js is installed in your system you need to install the necessary packages.

This can be done by `npm i`. You need to do this in two places. One in the main directory and another one in the `backend` directory.
Next, you need to modify the `.env` file given in the `backend` directory. Please put a valid OpenAI API key there. If you fail to 
do this step, you will not get any response from the application.

Next we can start the servers. Do `npm start` in the main directory and another `npm start` in the backend directory. You can now use the
application.

# Acknowledgements

I make use of this API - https://github.com/alfaArghya/alfa-leetcode-api?tab=readme-ov-file
to get descriptions of leetcode problems. It is rate limited so don't use it to get a lot of
problems in a short time otherwise you won't get any problems.

leetcode.com - One of the best resources online for interview preparation.