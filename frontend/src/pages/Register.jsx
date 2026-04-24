import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        setLoading(true);
        try {
            const { error: signUpError } = await signUp(email, password);
            if (signUpError) throw signUpError;
            setSuccess('Conta criada! Verifique seu email para confirmar o cadastro.');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            if (err.message?.includes('already registered')) {
                setError('Este email já está cadastrado.');
            } else {
                setError('Erro ao criar conta: ' + (err.message || 'Tente novamente.'));
            }
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
                    <h2 className="text-3xl font-bold mb-4">Comece agora gratuitamente</h2>
                    <p className="text-lg text-blue-100 opacity-90">
                        Configure sua conta em minutos e transforme suas reuniões em insights acionáveis com IA.
                    </p>
                </div>
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-overlay filter blur-3xl"></div>
                </div>
            </div>

            {/* Right Area - Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-1/2 lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div className="text-center">
                        <h2 className="text-3xl font-extrabold text-gray-900">Criar conta</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Cadastre-se no AI Meet
                        </p>
                    </div>

                    <div className="mt-8">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="text-red-600 text-sm text-center font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="text-green-700 text-sm text-center font-medium bg-green-50 p-3 rounded-lg border border-green-100">
                                    {success}
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Senha</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirmar senha</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repita a senha"
                                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#2f5c96] hover:bg-[#1e40af] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Criando conta...' : 'Criar conta'}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-sm text-gray-600">
                            Já tem uma conta?{' '}
                            <Link to="/login" className="font-medium text-[#2f5c96] hover:underline">
                                Entrar
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
