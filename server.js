// server.js
import express from 'express';
import knex from 'knex';
import fetch from 'node-fetch';
import {
  HEADERS,
  INTERCOM_CONFIG,
  TECH_REQUIRED_ANSWER,
  INTERCOM_QUESTIONS,
  FIRST_QUESTION,
  SCOOTER_OKAY_ANSWERS, REP_CONTACT_ANSWER
} from "./intercom-config.js";

class Server {

  db;

  setUpServer() {
    this.db = this.setUpDb();
    this.setUpApp();
  }

  async bookAppointment(userId, appointmentTime) {
    const availableTechnician = await this.getAvailableTechnician();
    if (!availableTechnician) {
      return 'No technicians are available at the requested time.';
    }

    const appointmentDate = appointmentTime ? new Date(appointmentTime) : this.getAppointmentTime();

    await this.db('Appointments').insert({
      user_id: userId,
      technician_id: availableTechnician.id,
      appointment_date: appointmentDate
    });

    return await this.getAppointmentMessage(availableTechnician, appointmentDate, userId);
  }

  async updateAppointmentTime(userId, currentAppointmentDate, newAppointmentTime) {
    const latestAppt = await this.db('Appointments')
      .select()
      .where('user_id', userId)
      .orderBy('id', 'desc')
      .first();

    const updated = await this.db('Appointments')
      .where({id: latestAppt.id})
      .update({appointment_date: new Date(newAppointmentTime)});

    if (updated) {
      const technician = await this.db('Technicians')
        .select('name', 'phone')
        .where({id: latestAppt.technician_id})
        .first();
      return await this.getAppointmentMessage(technician, new Date(newAppointmentTime), userId);
    }

    return 'Failed to update appointment time.';
  }

  async getAppointmentMessage(availableTechnician, appointmentDate, userId) {
    const user = await this.db('Users').select('address').where({id: userId}).first();
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    const formattedDate = appointmentDate.toLocaleDateString('en-US', options);
    return `Appointment booked with technician ${availableTechnician.name} on ${formattedDate} at ${user.address}. The technician can be reached at ${availableTechnician.phone}.`;
  }

  async getRepNeededMessage(userId) {
    const user = await this.db('Users').select('phone').where({id: userId}).first();
    if (user && user.phone) {
      return `${REP_CONTACT_ANSWER} You will be contacted at ${user.phone}.`;
    } else {
      return REP_CONTACT_ANSWER;
    }
  }

  async getAvailableTechnician() {
    const technicians = await this.db('Technicians').select('*');
    const availableTechnicians = technicians.filter(tech => tech.availability === 'Available');
    const availableTechnician = availableTechnicians[Math.floor(Math.random() * availableTechnicians.length)];
    return availableTechnician;
  }

  getAppointmentTime() {
    const appointmentDate = new Date();
    const daysToAdd = Math.floor(Math.random() * 5) + 1; // Random number between 1 and 5
    appointmentDate.setDate(appointmentDate.getDate() + daysToAdd);

    const randomHour = Math.floor(Math.random() * 9) + 9; // Random number between 9 and 17
    appointmentDate.setHours(randomHour, 0, 0, 0);

    return appointmentDate;
  }

  async closeConversation(conversationId) {
    const resp = await fetch(
      `https://api.intercom.io/conversations/${conversationId}/parts`,
      {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          message_type: 'close',
          type: 'admin',
          admin_id: INTERCOM_CONFIG.adminId,
          body: 'Closed'
        })
      }
    );

    const data = await resp.json();
  }

  async deleteConversation(conversationId) {
    return this.db('Conversations').where('id', conversationId).del();
  }

  getNextQuestion(currentQuestion, answer, questions = INTERCOM_QUESTIONS) {
    if (questions.question === currentQuestion) {
      let nextStep = questions[answer];
      if (nextStep && typeof nextStep === 'object') {
        return nextStep.question ? nextStep.question : nextStep;
      }
      return nextStep;
    }

    for (let key in questions) {
      if (typeof questions[key] === 'object') {
        let result = this.getNextQuestion(currentQuestion, answer, questions[key]);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }


  async getConversation(userId) {
    const conversation = await this.db('Conversations').where({user_id: userId});
    if (conversation?.[0]) {
      const resp = await fetch(
        `https://api.intercom.io/conversations/${conversation[0].id}?`,
        {
          method: 'GET',
          headers: HEADERS
        }
      );

      const data = await resp.text();
      return data;
    } else {
      return null;
    }
  }

  async sendMessage(conversationId, message) {
    const resp = await fetch(
      `https://api.intercom.io/conversations/${conversationId}/reply`,
      {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          message_type: 'comment',
          type: 'user',
          intercom_user_id: INTERCOM_CONFIG.contactId,
          body: message
        })
      }
    );

    const data = await resp.json();
    return data;
  }

  setUpDb() {
    return knex({
      client: 'mysql', connection: {
        host: '127.0.0.1', user: 'root', password: 'Aa123456', database: 'Scootrepair'
      }
    });
  }

  setUpApp() {
    const app = express();

    app.use(express.json());

    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Accept,Accept-Language,Content-Language,Content-Type');
      next();
    });

    app.post('/register', (req, res) => {
      const {username, password, email, phone, address} = req.body;
      this.db('Users')
        .where({username})
        .orWhere({email})
        .first()
        .then(user => {
          if (user) {
            if (user.username === username) {
              return res.status(400).send('Username already taken');
            } else if (user.email === email) {
              return res.status(400).send('Email already taken');
            }
          } else {
            this.db('Users').insert({username, password, email, phone, address})
              .then((data) => {
                return res.status(200).send('' + data[0]);
              })
              .catch(err => res.status(500).send('Error registering user'));
          }
        })
        .catch(err => res.status(500).send('Error checking user existence'));
    });

    app.post('/login', (req, res) => {
      const {username, password} = req.body;
      this.db('Users').where({username, password})
        .then(users => {
          if (users.length) {
            res.status(200).send({id: users[0].id});
          } else {
            res.status(400).send({Error: 'Invalid credentials'});
          }
        })
        .catch(err => res.status(500).send('Error logging in'));
    });

    app.post('/appointments', (req, res) => {
      const {userId, technicianId, appointmentDate} = req.body;
      this.db('Appointments').insert({user_id: userId, technician_id: technicianId, appointment_date: appointmentDate})
        .then(() => res.status(200).send('Appointment created successfully'))
        .catch(err => res.status(500).send('Error creating appointment'));
    });

    app.get('/appointments/:userId', (req, res) => {
      const {userId} = req.params;
      this.db('Appointments').where({user_id: userId})
        .then(appointments => res.status(200).json(appointments))
        .catch(err => res.status(500).send('Error fetching appointments'));
    });


    app.post('/reviews', (req, res) => {
      const {userId, technicianId, reviewText, rating} = req.body;
      this.db('Reviews').insert({user_id: userId, technician_id: technicianId, review_text: reviewText, rating})
        .then(() => res.status(200).send('Review submitted successfully'))
        .catch(err => res.status(500).send('Error submitting review'));
    });

    app.get('/reviews/:technicianId', (req, res) => {
      const {technicianId} = req.params;
      this.db('Reviews').where({technician_id: technicianId})
        .then(reviews => res.status(200).json(reviews))
        .catch(err => res.status(500).send('Error fetching reviews'));
    });

    app.get('/technicians', (req, res) => {
      this.db('Technicians')
        .then(technicians => res.status(200).json(technicians))
        .catch(err => res.status(500).send('Error fetching technicians'));
    });

    app.post('/start-conversation/:userId', async (req, res) => {
      const {userId} = req.params;

      const resp = await fetch(`https://api.intercom.io/conversations`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify({
          from: {
            type: 'user', id: INTERCOM_CONFIG.contactId
          }, body: FIRST_QUESTION
        })
      });
      const data = await resp.json();
      const conversationId = data.conversation_id;
      this.db('Conversations').insert({
        user_id: userId,
        id: conversationId
      }).catch(err => console.error('Error ', err));

      res.status(200).json(data);
    });

    app.get('/conversations/:userId', async (req, res) => {
      const {userId} = req.params;
      const data = await this.getConversation(userId);
      res.status(200).json(data);
    });

    app.post('/reschedule-appointment', async (req, res) => {
      const {userId, currentAppointmentDate, newAppointmentTime} = req.body;
      const reply = await this.updateAppointmentTime(userId, currentAppointmentDate, newAppointmentTime);
      res.json({reply});
    });

    app.post('/next-question', async (req, res) => {
      const {userId, conversationId, currentQuestion, answer} = req.body;
      await this.sendMessage(conversationId, answer);
      let reply = this.getNextQuestion(currentQuestion, answer);
      let isConversationOver = SCOOTER_OKAY_ANSWERS.includes(reply);
      const isRepNeeded = reply === REP_CONTACT_ANSWER;
      const isTechNeeded = reply === TECH_REQUIRED_ANSWER;
      if (isTechNeeded || isConversationOver || isRepNeeded) {
        if (isTechNeeded) {
          reply = await this.bookAppointment(userId);
        }
        if (isRepNeeded) {
          reply = await this.getRepNeededMessage(userId);
        }
        isConversationOver = await this.terminateConversation(conversationId);
      }
      console.log({isTechNeeded, isConversationOver, isRepNeeded, userId})
      await this.sendMessage(conversationId, reply);
      res.json({reply, isConversationOver, conversation_id: conversationId});
    });

    app.listen(3000, () => {
      console.log('Server is running on port 3000');
    });
  }

  async terminateConversation(conversationId) {
    await this.closeConversation(conversationId);
    await this.deleteConversation(conversationId);
    return true;
  }
}

const server = new Server();
server.setUpServer();
