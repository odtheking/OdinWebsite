import express from "express";
import bodyParser from "body-parser";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    ScanCommand,
    GetCommand,
    PutCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import atob from "atob";

const app = express()
const port = process.env.PORT || 3000
const UPDATE_PASSWORD = process.env.UPDATE_PASSWORD
const CREATE_PASSWORD = process.env.CREATE_PASSWORD

app.use(bodyParser.text({ type: "*/*" }))

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-north-1" })
const ddb = DynamoDBDocumentClient.from(client)
const tableName = "DevPlayers"

app.get("/", async (req, res) => {
    try {
        const response = await ddb.send(new ScanCommand({ TableName: tableName }))
        res.json(response.Items || [])
    } catch (err) {
        console.error("DynamoDB Error:", err)
        res.status(500).json({ error: err.message })
    }
})

app.post("/", async (req, res) => {
    try {
        const decodedBody = atob(req.body)
        const parts = decodedBody.split(", ")
        if (parts.length !== 6) return res.status(400).json({ error: "Invalid input format" })

        const [devName, wingsColorStr, sizeStr, wingsStr, customName, password] = parts
        const wingsColor = JSON.parse(wingsColorStr)
        const size = JSON.parse(sizeStr)
        const wings = wingsStr === "true"

        const existingItem = await ddb.send(new GetCommand({ TableName: tableName, Key: { DevName: devName } }))

        if (existingItem.Item) {
            if (password !== UPDATE_PASSWORD) return res.status(403).send("Nope")

            await ddb.send(
                new UpdateCommand({
                    TableName: tableName,
                    Key: { DevName: devName },
                    UpdateExpression:
                        "set WingsColor = :wc, Size = :s, Wings = :w, CustomName = :cn",
                    ExpressionAttributeValues: {
                        ":wc": wingsColor,
                        ":s": size,
                        ":w": wings,
                        ":cn": customName,
                    },
                })
            )

            res.json({
                message: `Updated ${devName} with wings_color ${JSON.stringify(
                    wingsColor
                )}, size ${size}, wings ${wings}, custom_name ${customName}`,
            })
        } else {
            if (password !== CREATE_PASSWORD) return res.status(403).send("Nope!");

            await ddb.send(
                new PutCommand({
                    TableName: tableName,
                    Item: {
                        DevName: devName,
                        WingsColor: wingsColor,
                        Size: size,
                        Wings: wings,
                        CustomName: customName,
                    },
                })
            )

            res.json({ message: `Added user ${devName} with custom_name ${customName}` })
        }
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.listen(port, () => console.log(`Server running on port ${port}`))
