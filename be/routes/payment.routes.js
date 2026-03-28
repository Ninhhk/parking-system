const express = require("express");

const webhookController = require("../controllers/webhook.payment.controller");

const router = express.Router();

router.post("/payos/webhook", webhookController.payosWebhook);

module.exports = router;
