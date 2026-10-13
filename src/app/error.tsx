"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="page-width empty-state"><h1>Vamos tentar de novo.</h1><p>Não foi possível exibir esta página.</p><button className="primary-button" onClick={reset}>Recarregar</button></main>; }
