export const TEMPLATE_NAMES = {
  CONFIRMATION: "confirmacion_visitas",
  DEFAULT: "prueba",
};

export const ACCESS_CONTROL = {
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
};

export const isValidIncomingMessage = (message) => {
  if (!message || typeof message !== "object") {
    console.error(
      "Invalid message format: message is missing or not an object."
    );
    return false;
  }

  if (
    !message.entry ||
    !Array.isArray(message.entry) ||
    message.entry.length === 0
  ) {
    console.error(
      "Invalid message format: 'entry' property is missing or not an array."
    );
    return false;
  }

  const entry = message.entry[0];
  if (
    !entry ||
    !entry.changes ||
    !Array.isArray(entry.changes) ||
    entry.changes.length === 0
  ) {
    console.error(
      "Invalid message format: 'entry' object does not contain 'changes' array or it is empty."
    );
    return false;
  }

  return true;
};

export const respondWithErrorMessage = (message) => ({
  statusCode: 400,
  headers: ACCESS_CONTROL,
  body: JSON.stringify({ error: message }),
});

export const getTemplateComponents = (metadata) => {
  if (metadata) {
    const { name, date, hour } = metadata;
    return [
      {
        type: "body",
        parameters: [
          { type: "text", text: name },
          { type: "text", text: date },
          { type: "text", text: hour },
        ],
      },
    ];
  }
  return [];
};
