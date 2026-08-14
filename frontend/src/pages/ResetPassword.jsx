import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, updatePassword, signOut } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (!user) {
            setError('Este link expirou ou já foi utilizado. Solicite um novo email de recuperação.');
            return;
        }

        if (password.length < 8) {
            setError('A nova senha deve ter pelo menos 8 caracteres.');
            return;
        }

        if (password !== passwordConfirmation) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await updatePassword(password);
            if (updateError) throw updateError;

            setSuccess('Senha atualizada com sucesso. Você será direcionado para o login.');
            await signOut();
            window.setTimeout(() => navigate('/login', { replace: true }), 1500);
        } catch {
            setError('Não foi possível atualizar a senha. Solicite um novo email de recuperação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white">
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2c5282] to-[#4299e1] flex-col justify-center items-center text-white p-12 relative overflow-hidden">
                <div className="z-10 text-center max-w-md">
                    <div className="flex justify-center mb-8">
                        <BrainCircuit size={64} className="text-white opacity-90" />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Crie uma nova senha</h2>
                    <p className="text-lg text-blue-100 opacity-90">
                        Use uma senha exclusiva e guarde-a em um gerenciador de senhas.
                    </p>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-1/2 lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div className="text-center">
                        <h1 className="text-3xl font-extrabold text-gray-900">Redefinir senha</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Informe e confirme sua nova senha.
                        </p>
                    </div>

                    <div className="mt-8">
                        {error && (
                            <div role="alert" className="mb-5 text-red-600 text-sm text-center font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                                {error}
                            </div>
                        )}

                        {success ? (
                            <div role="status" className="text-green-700 text-sm text-center font-medium bg-green-50 p-4 rounded-lg border border-green-100">
                                {success}
                            </div>
                        ) : user ? (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                                        Nova senha
                                    </label>
                                    <input
                                        id="new-password"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        minLength={8}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="new-password-confirmation" className="block text-sm font-medium text-gray-700">
                                        Confirmar nova senha
                                    </label>
                                    <input
                                        id="new-password-confirmation"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        minLength={8}
                                        value={passwordConfirmation}
                                        onChange={(event) => setPasswordConfirmation(event.target.value)}
                                        className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#2f5c96] hover:bg-[#1e40af] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Atualizando...' : 'Salvar nova senha'}
                                </button>
                            </form>
                        ) : (
                            <div role="alert" className="text-red-600 text-sm text-center font-medium bg-red-50 p-4 rounded-lg border border-red-100">
                                Este link expirou ou já foi utilizado. Solicite um novo email de recuperação.
                            </div>
                        )}

                        <div className="mt-6 text-center">
                            <Link to="/recuperar-senha" className="text-sm font-medium text-[#2f5c96] hover:underline">
                                Solicitar outro email
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
