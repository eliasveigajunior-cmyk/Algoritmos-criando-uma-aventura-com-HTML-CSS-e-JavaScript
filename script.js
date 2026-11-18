import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.LinkedHashSet;
import java.util.Set;

public class ServidorAventura {

    // Estado do algoritmo (Grafo e Estruturas de Dados)
    private static String cenaAtual = "entrada";
    private static final Set<String> inventario = new LinkedHashSet<>();
    private static String ultimoLog = "Sistema iniciado: cenaAtual = \"entrada\"";

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        // Rota para o CSS
        server.createContext("/style.css", exchange -> {
            byte[] css = Files.readAllBytes(Paths.get("style.css"));
            exchange.getResponseHeaders().set("Content-Type", "text/css; charset=UTF-8");
            exchange.sendResponseHeaders(200, css.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(css);
            }
        });

        // Rota principal do jogo
        server.createContext("/", ServidorAventura::processarJogada);

        server.start();
        System.out.println("Servidor rodando! Acesse: http://localhost:8080");
    }

    private static void processarJogada(HttpExchange exchange) throws IOException {
        if (!exchange.getRequestURI().getPath().equals("/")) {
            exchange.sendResponseHeaders(404, -1);
            return;
        }

        // Leitura dos parâmetros da URL (?ir=..., ?acao=..., ?reset=true)
        String query = exchange.getRequestURI().getQuery();
        if (query != null) {
            for (String param : query.split("&")) {
                String[] par = param.split("=");
                if (par.length == 2) {
                    executarAcao(par[0], par[1]);
                }
            }
        }

        String html = montarPagina();
        byte[] resposta = html.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
        exchange.sendResponseHeaders(200, resposta.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(resposta);
        }
    }

    private static void executarAcao(String chave, String valor) {
        if (chave.equals("reset") && valor.equals("true")) {
            cenaAtual = "entrada";
            inventario.clear();
            ultimoLog = "inventario.clear(); cenaAtual = \"entrada\";";
        } else if (chave.equals("ir")) {
            cenaAtual = valor;
            ultimoLog = "Navegação no grafo -> cenaAtual = \"" + valor + "\"";
        } else if (chave.equals("acao")) {
            switch (valor) {
                case "pegar_lanterna":
                    inventario.add("Lanterna");
                    ultimoLog = "inventario.add(\"Lanterna\") -> true";
                    break;
                case "pegar_chave":
                    inventario.add("Chave Criptografada");
                    ultimoLog = "inventario.add(\"Chave Criptografada\") -> true";
                    break;
                case "responder_true":
                    inventario.add("Token Booleano");
                    cenaAtual = "cofre_aberto";
                    ultimoLog = "Expressão (true && false) || !false == true -> Token obtido!";
                    break;
            }
        }
    }

    private static String montarPagina() throws IOException {
        String titulo = "";
        String texto = "";
        StringBuilder opcoes = new StringBuilder();

        // Estrutura de decisão que controla os nós do grafo
        switch (cenaAtual) {
            case "entrada":
                titulo = "Portão do Templo do Código";
                texto = "Você está diante da entrada de um templo digital antigo. Há uma <strong>Lanterna</strong> caída perto da soleira e dois caminhos à frente.";
                if (!inventario.contains("Lanterna")) {
                    opcoes.append("<a class='btn item' href='/?acao=pegar_lanterna'>[Coletar Lanterna]</a>");
                }
                opcoes.append("<a class='btn' href='/?ir=corredor'>Entrar no Corredor Escuro</a>");
                opcoes.append("<a class='btn' href='/?ir=cofre'>Ir para a Sala do Cofre</a>");
                break;

            case "corredor":
                titulo = "Corredor das Sombras";
                if (inventario.contains("Lanterna")) {
                    texto = "Com a <strong>Lanterna</strong> acesa, você evita ponteiros nulos no chão e avista uma <strong>Chave Criptografada</strong> sobre um pedestal.";
                    if (!inventario.contains("Chave Criptografada")) {
                        opcoes.append("<a class='btn item' href='/?acao=pegar_chave'>[Coletar Chave Criptografada]</a>");
                    }
                    opcoes.append("<a class='btn' href='/?ir=nucleo'>Avançar para a Porta do Núcleo</a>");
                } else {
                    texto = "Está escuro demais! Sem uma lanterna no inventário, você corre o risco de cair em um <code>while(true)</code> sem saída.";
                    opcoes.append("<a class='btn perigo' href='/?ir=loop'>Tentar atravessar no escuro</a>");
                }
                opcoes.append("<a class='btn secundario' href='/?ir=entrada'>Voltar à Entrada</a>");
                break;

            case "cofre":
                titulo = "Sala do Cofre Lógico";
                texto = "Um terminal bloqueia o cofre. Na tela pisca o desafio: <code>(true && false) || !false</code>. Qual é o resultado?";
                opcoes.append("<a class='btn' href='/?acao=responder_true'>Responder: true</a>");
                opcoes.append("<a class='btn perigo' href='/?ir=firewall'>Responder: false</a>");
                opcoes.append("<a class='btn secundario' href='/?ir=entrada'>Voltar à Entrada</a>");
                break;

            case "cofre_aberto":
                titulo = "Cofre Desbloqueado";
                texto = "A condição avaliou para <code>true</code>! Você obteve o <strong>Token Booleano</strong>.";
                opcoes.append("<a class='btn' href='/?ir=entrada'>Voltar à Entrada</a>");
                break;

            case "nucleo":
                titulo = "Porta do Núcleo Central";
                texto = "Você alcançou o servidor principal. O sistema verifica suas credenciais no array de inventário.";
                if (inventario.contains("Chave Criptografada") && inventario.contains("Token Booleano")) {
                    opcoes.append("<a class='btn secreto' href='/?ir=secreto'>Usar Chave + Token (Acesso Root)</a>");
                }
                if (inventario.contains("Chave Criptografada")) {
                    opcoes.append("<a class='btn' href='/?ir=vitoria'>Destravar com a Chave Criptografada</a>");
                }
                opcoes.append("<a class='btn perigo' href='/?ir=firewall'>Forçar acesso sem credenciais</a>");
                opcoes.append("<a class='btn secundario' href='/?ir=corredor'>Voltar ao Corredor</a>");
                break;

            case "loop":
                titulo = "FIM DE JOGO: Loop Infinito";
                texto = "Você tropeçou no escuro e entrou em um ciclo infinito sem <code>break</code>. A memória esgotou!";
                opcoes.append("<a class='btn' href='/?reset=true'>Reiniciar Algoritmo</a>");
                break;

            case "firewall":
                titulo = "FIM DE JOGO: Bloqueado pelo Firewall";
                texto = "Condição inválida! O firewall encerrou sua conexão imediatamente.";
                opcoes.append("<a class='btn' href='/?reset=true'>Reiniciar Algoritmo</a>");
                break;

            case "vitoria":
                titulo = "VITÓRIA: Compilador Supremo";
                texto = "Parabéns! Você percorreu o grafo com sucesso e compilou o núcleo do templo.";
                opcoes.append("<a class='btn' href='/?reset=true'>Jogar Novamente</a>");
                break;

            case "secreto":
                titulo = "FINAL SECRETO: Arquiteto Quântico";
                texto = "Todas as condições booleanas foram satisfeitas! Você desbloqueou o núcleo oculto com privilégios máximos.";
                opcoes.append("<a class='btn secreto' href='/?reset=true'>Jogar Novamente</a>");
                break;
        }

        String listaInventario = inventario.isEmpty() ? "Vazio []" : inventario.toString();

        String template = new String(Files.readAllBytes(Paths.get("index.html")), StandardCharsets.UTF_8);
        return template
                .replace("{{TITULO}}", titulo)
                .replace("{{TEXTO}}", texto)
                .replace("{{OPCOES}}", opcoes.toString())
                .replace("{{INVENTARIO}}", listaInventario)
                .replace("{{DEBUG_CENA}}", cenaAtual)
                .replace("{{DEBUG_LOG}}", ultimoLog);
    }
}
