import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhooks';
import meetingsRoutes from './routes/meetings';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());

// Rotas
app.use('/api/webhooks', webhookRoutes);
app.use('/api/meetings', meetingsRoutes);

// Rota de Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend is running' });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
