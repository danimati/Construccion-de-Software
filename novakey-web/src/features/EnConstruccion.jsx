// Pantalla temporal para los módulos cuyo frontend aún no se ha reconstruido en React.
export default function EnConstruccion({ titulo }) {
  return (
    <div className="pagina">
      <header className="cab">
        <div>
          <h1>{titulo}</h1>
          <p>Este módulo está disponible en la API; su pantalla se reconstruirá en React.</p>
        </div>
      </header>
      <p className="vacio">En construcción.</p>
    </div>
  );
}
