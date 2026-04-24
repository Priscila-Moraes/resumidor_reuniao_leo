import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { BrainCircuit, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const { error: resetError } = await resetPassword(email);
            if (resetError) throw resetError;
            setSuccess('Email enviado! Verifique sua caixa de entrada para redefinir sua senha.');
        } catch (err) {
            setError('Erro ao enviar email: ' + (err.message || 'Tente novamente.'));
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Area */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2c5282] to-[#4299e1] flex-col justify-center items-center text-white p-12 relative overflow-hidden">
                <div className="z-10 text-center max-w-md">
                    <div className="flex justify-center mb-8">
                        <BrainCircuit size={64} className="text-white opacity-90" />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Recuperar acesso</h2>
                    <p className="text-lg text-blue-100 opacity-90">
                        Enviaremos um link para você redefinir sua senha com segurança.
                    </p>
                </div>
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-overlay filter blur-3xl"></div>
                </div>
            </div>

            {/* Right Area */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-1/2 lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div className="text-center">
                        <h2 className="text-3xl font-extrabold text-gray-900">Esqueceu a senha?</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Informe seu email para receber o link de redefinição
                        </p>
                    </div>

                    <div className="mt-8">
                        {!success ? (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="text-red-600 text-sm text-center font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="nome@empresa.com"
                                        className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#2f5c96] hover:bg-[#1e40af] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                                </button>
                            </form>
                        ) : (
                            <div className="text-green-700 text-sm text-center font-medium bg-green-50 p-4 rounded-lg border border-green-100">
                                {success}
                            </div>
                        )}

                        <div className="mt-6 text-center">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2f5c96] hover:underline"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Voltar para o login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
