# Fovus Full Stack Project

Codelabs Documentation Link: https://codelabs-preview.appspot.com/?file_id=1kJ1U9GGVfWyOywWSRJfyNuLAN4xIAqgTCPj2TTMMC5o#3 

## Steps to recreate the Application:
1. Clone the repo - both folders are different applications.
- coding_challenge/my-app is the frontend application.
- Install Node
  
      - Run > npm i
  
      - Run > npm start
  
- App opens on localhost:3000

1. coding_challenge/lib/full-stack-stack.ts is the backend CDK application
   - Install Node
   - Install AWS CLI
   - Configure AWS CLI
  
         - Run > npm i
  
   - Navigate to the Lambda Directory(coding_challenge/lambda) and  Run > npm i
   - Navigate back to parent dir
  
         - Run > cdk bootstrap
  
         - Run > cdk synth
  
         - Run > cdk deploy

### REFERENCES 
1. https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-typescript.html
2. https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html
3. https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html
4. https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/
5. https://react.dev/
6. https://fullstackdojo.medium.com/s3-upload-with-presigned-url-react-and-nodejs-b77f348d54cc 

