export const INTERCOM_CONFIG = {
  adminId: '****',
  token: '****',
  userId: '****',
  contactId: '****'
}

export const TECH_REQUIRED_ANSWER = "The problem requires professional attention from a certified tech.";

export const SCOOTER_OKAY_ANSWERS = [
  "The problem might not require professional attention. Check for loose parts.",
  "The scooter seems fine. If you notice any other issues, bring it to a professional.",
  "Charge the battery. If the problem persists, it requires professional attention."
];

export const REP_CONTACT_ANSWER = "A representative will reach out to you between 9 AM and 5 PM.";

export const FIRST_QUESTION = "Is the scooter starting?";

export const INTERCOM_QUESTIONS = {
  "question": FIRST_QUESTION,
  "yes": {
    "question": "Is the scooter making any unusual noise?",
    "yes": {
      "question": "Is the noise coming from the engine?",
      "yes": {
        "question": "Does the noise increase with speed?",
        "yes": TECH_REQUIRED_ANSWER,
        "no": TECH_REQUIRED_ANSWER
      },
      "no": {
        "question": "Is the noise coming from the wheels?",
        "yes": REP_CONTACT_ANSWER,
        "no": "The problem might not require professional attention. Check for loose parts."
      }
    },
    "no": {
      "question": "Are all lights and indicators working properly?",
      "yes": "The scooter seems fine. If you notice any other issues, bring it to a professional.",
      "no": {
        "question": "Is the headlight working?",
        "yes": REP_CONTACT_ANSWER,
        "no": TECH_REQUIRED_ANSWER
      }
    }
  },
  "no": {
    "question": "Is the battery charged?",
    "yes": {
      "question": "Is the starter motor running?",
      "yes": TECH_REQUIRED_ANSWER,
      "no": {
        "question": "Do you hear any clicking sound when trying to start?",
        "yes": REP_CONTACT_ANSWER,
        "no": TECH_REQUIRED_ANSWER
      }
    },
    "no": "Charge the battery. If the problem persists, it requires professional attention."
  }
}


export const HEADERS = {
  'Content-Type': 'application/json',
  'Intercom-Version': '2.11',
  Authorization: `Bearer ${INTERCOM_CONFIG.token}`
};
