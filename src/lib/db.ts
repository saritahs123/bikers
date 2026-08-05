import { RDSDataClient, ExecuteStatementCommand, Field } from "@aws-sdk/client-rds-data";

let client: RDSDataClient | null = null;

const getClient = () => {
  if (!client) {
    client = new RDSDataClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return client;
};

const getResourceArn = () => process.env.AWS_RDS_CLUSTER_ARN!;
const getSecretArn = () => process.env.AWS_RDS_SECRET_ARN!;
const getDatabase = () => process.env.AWS_RDS_DATABASE!;

const parseValue = (field: Field) => {
  if (field.isNull !== undefined && field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.blobValue !== undefined) return field.blobValue;
  if (field.arrayValue !== undefined) {
    // Basic array parsing (string/long/etc array)
    if (field.arrayValue.stringValues) return field.arrayValue.stringValues;
    if (field.arrayValue.longValues) return field.arrayValue.longValues;
    if (field.arrayValue.doubleValues) return field.arrayValue.doubleValues;
    if (field.arrayValue.booleanValues) return field.arrayValue.booleanValues;
  }
  return null;
};

export const query = async (sql: string, parameters: any[] = []) => {
  try {
    const formattedParameters = parameters.map((p, i) => {
      let value: any = { isNull: true };
      if (p !== null && p !== undefined) {
        if (typeof p === "string") value = { stringValue: p };
        else if (typeof p === "number") {
          if (Number.isInteger(p)) value = { longValue: p };
          else value = { doubleValue: p };
        }
        else if (typeof p === "boolean") value = { booleanValue: p };
      }
      return {
        name: `${i + 1}`,
        value
      };
    });

    const command = new ExecuteStatementCommand({
      resourceArn: getResourceArn(),
      secretArn: getSecretArn(),
      database: getDatabase(),
      sql: sql.replace(/\$(\d+)/g, ':$1'), // Convert $1, $2 to :1, :2 for compatibility
      parameters: formattedParameters,
      includeResultMetadata: true,
    });

    const response = await getClient().send(command);
    
    // Si se retorna formatRecordsAs: "JSON", RDS Data API (v1) devuelve formattedRecords
    if (response.formattedRecords) {
      return JSON.parse(response.formattedRecords);
    }
    
    // Fallback si no soporta formatRecordsAs (ej. postgres < 10)
    if (!response.records || !response.columnMetadata) {
      return [];
    }

    const columns = response.columnMetadata.map((col) => col.name || "unknown");

    const formattedRecords = response.records.map((record) => {
      const row: any = {};
      record.forEach((field, index) => {
        row[columns[index]] = parseValue(field);
      });
      return row;
    });

    return formattedRecords;
  } catch (error) {
    console.error("Database Query Error:", error);
    throw error;
  }
};
