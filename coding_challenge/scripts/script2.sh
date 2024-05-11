#!/bin/bash


export AWS_DEFAULT_REGION="us-east-1"

# S3 bucket and DynamoDB table names
echo ${MY_S3_BUCKET_NAME}

# Function to download a file from S3
download_from_s3() {
    local file_key="$1"
    local local_path="$2"

    aws s3 cp "s3://${BUCKET_NAME}/${file_key}" "${local_path}"
}
# Function to retrieve data from DynamoDB
retrieve_from_dynamodb() {
    local item_id="$1"
    
    aws dynamodb get-item \
        --region "${AWS_DEFAULT_REGION}" \
        --table-name "${DYNAMODB_TABLE_NAME}" \
        --key "{\"id\": {\"S\": \"${item_id}\"}}" \
        --query 'Item.{ input_text: input_text.S, input_file_path: input_file_path.S }' \
        --output json
}

# Function to append text to a file
append_text_to_file() {
    local input_text="$1"
    local input_file_path="$2"
    echo "${input_text}" >> "${input_file_path}"
}

# Function to upload a file to S3
upload_to_s3() {
    local local_path="$1"
    local output_file_key="$2"
    aws s3 cp "${local_path}" "s3://${BUCKET_NAME}/${output_file_key}"
}


save_output_to_dynamodb() {
    local id="$1"
    local input_text="$2"
    local input_file_path="$3"
    local output_file_path="$4"

    # Store the output details in DynamoDB
    aws dynamodb put-item \
        --table-name "${DYNAMODB_TABLE_NAME}" \
        --item "{\"id\": {\"S\": \"${id}\"}, \"input_text\": {\"S\": \"${input_text}\"}, \"input_file_path\": {\"S\": \"${input_file_path}\"}, \"output_file_path\": {\"S\": \"${output_file_path}\"}}"
}

if [ -z "$1" ]; then
    echo "Error: item_id is required as an argument."
    exit 1
fi

# Retrieve item_id from command-line argument
item_id="$1"
BUCKET_NAME="$2"
DYNAMODB_TABLE_NAME="$3"


echo "inside"
echo ${item_id}
echo ${BUCKET_NAME}
echo ${DYNAMODB_TABLE_NAME}

result=$(retrieve_from_dynamodb "${item_id}")

# Parse the JSON output to extract input_text and input_file_path
input_text=$(echo "${result}" | jq -r '.input_text')
input_file_path=$(echo "${result}" | jq -r '.input_file_path')
output_file_path="output_"${input_file_path}


# Print the retrieved values for testing (optional)
echo "Input Text: ${input_text}"
echo "Input File Path: ${input_file_path}"
echo "output File Path: ${output_file_path}"

# Download input file from S3
download_from_s3 "${input_file_path}" "input_file.txt" 

# Append input text to the input file
append_text_to_file "${input_text}" "input_file.txt"

# Upload modified file to S3 as output file
upload_to_s3 "input_file.txt" ${output_file_path}



save_output_to_dynamodb "${item_id}" "${input_text}" "${input_file_path}" "${output_file_path}"