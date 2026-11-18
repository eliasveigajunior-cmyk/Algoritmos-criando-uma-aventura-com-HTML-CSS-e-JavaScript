import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.awt.Desktop;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.function.Consumer;
import java.util.function.Predicate;

public class ServidorAventura {

    static class Aresta {
        final String rotulo;
        final String destinoId;
        final String estiloCss;
        final Predicate<EstadoJogo> visivelSe;
        final Consumer<EstadoJogo> aoExecutar;

        Aresta(String rotulo, String destinoId, String estiloCss,
               Predicate<EstadoJogo> visivelSe, Consumer<EstadoJogo> aoExecutar) {
            this.rotulo = rotulo;
            this.destinoId = destinoId;
            this.estiloCss = estiloCss;
            this.visivelSe = visivelSe;
            this.aoExecutar = aoExecutar;
        }
    }

    static class Cena {
        final String id;
        final String nomeCurto;
        final String titulo;
        final String descricao;
        final String tipoEnigma;
        final boolean ehFinal;
        final int x, y;
        final List<Aresta> arestas = new ArrayList<>();

        Cena(String id, String nomeCurto, String titulo, String descricao,
             String tipoEnigma, boolean ehFinal, int x, int y) {
            this.id = id;
            this.nomeCurto = nomeCurto;
            this.titulo = titulo;
            this.descricao = descricao;
            this.tipoEnigma = tipoEnigma;
            this.ehFinal = ehFinal;
            this.x = x;
            this.y = y;
        }

        Cena adicionarAresta(String rotulo, String destinoId, String estiloCss,
                             Predicate<EstadoJogo> condicao, Consumer<EstadoJogo> acao) {
            arestas.add(new Aresta(rotulo, destinoId, estiloCss, condicao, acao));
            return this;
        }
    }

    static class EstadoJogo {
        String cenaAtual = "entrada";
        int energiaRAM = 100;
        int pontos = 0;
        Set<String> inventario = new LinkedHashSet<>();
        Set<String> visitados = new LinkedHashSet<>();
        Deque<String> pilhaCaminho = new ArrayDeque<>();
        String feedback = "Bem-vindo! Explore o grafo gerenciando sua memória RAM.";
        String tipoFeedback = "info";
        String ultimoLog = "Grafo carregado: 13 vértices inicializados em memória.";

        EstadoJogo() {
            visitados.add("entrada");
            pilhaCaminho.push("entrada");
        }
    }

    private static final Map<String, Cena> GRAFO = new LinkedHashMap<>();
    private static EstadoJogo estado = new EstadoJogo();

    public static void main(String[] args) throws IOException {
        construirGrafo();

        // Tenta iniciar na porta 8080; se estiver ocupada, escolhe uma porta livre automaticamente
        HttpServer server;
        try {
            server = HttpServer.create(new InetSocketAddress(8080), 0);
        } catch (IOException e) {
            server = HttpServer.create(new InetSocketAddress(0), 0);
        }

        int porta = server.getAddress().getPort();
        String urlLocal = "http://localhost:" + porta;

        server.createContext("/style.css", exchange -> {
            try {
                byte[] css = lerArquivoRecurso("style.css");
                exchange.getResponseHeaders().set("Content-Type", "text/css; charset=UTF-8");
                exchange.sendResponseHeaders(200, css.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(css);
                }
            } catch (Exception ex) {
                ex.printStackTrace();
                exchange.sendResponseHeaders(404, -1);
            }
        });

        server.createContext("/", ServidorAventura::tratarRequisicao);
        server.start();

        System.out.println("====================================================");
        System.out.println("  SERVIDOR ATIVO! NÃO FECHE ESTA JANELA.");
        System.out.println("  Abra no navegador: " + urlLocal);
        System.out.println("====================================================");

        // Abre o navegador automaticamente
        try {
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().browse(new URI(urlLocal));
            }
        } catch (Exception ignored) {
        }
    }

    // Procura o arquivo na pasta atual, na pasta src/ ou no classpath da IDE
    private static byte[] lerArquivoRecurso(String nomeArquivo) throws IOException {
        Path[] caminhosPossiveis = {
            Paths.get(nomeArquivo),
            Paths.get("src", nomeArquivo),
            Paths.get("bin", nomeArquivo)
        };

        for (Path p : caminhosPossiveis) {
            if (Files.exists(p)) {
                return Files.readAllBytes(p);
            }
        }

        try (InputStream is = ServidorAventura.class.getResourceAsStream("/" + nomeArquivo)) {
            if (is != null) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] dados = new byte[4096];
                int lidos;
                while ((lidos = is.read(dados)) != -1) {
                    buffer.write(dados, 0, lidos);
                }
                return buffer.toByteArray();
            }
        }

        throw new IOException("Arquivo não encontrado: " + nomeArquivo
                + ". Coloque-o na mesma pasta de ServidorAventura.java.");
    }

    private static void construirGrafo() {
        GRAFO.clear();

        Cena entrada = new Cena(
            "entrada", "Entrada", "Portão do Templo do Código",
            "Você está no nó raiz (<code>entrada</code>) de um sistema antigo. Uma <strong>Lanterna LED</strong> pisca no chão. Dois barramentos se dividem à frente.",
            null, false, 80, 175
        );
        entrada.adicionarAresta(
            "[Coletar] Lanterna LED (+15 XP)", "entrada", "item",
            e -> !e.inventario.contains("Lanterna LED"),
            e -> {
                e.inventario.add("Lanterna LED");
                e.pontos += 15;
                e.feedback = "Item adicionado: inventario.add(\"Lanterna LED\")";
                e.tipoFeedback = "sucesso";
                e.ultimoLog = "inventario.add(\"Lanterna LED\") | pontos = " + e.pontos;
            }
        );
        entrada.adicionarAresta("Seguir para o Corredor das Sombras (-10% RAM)", "corredor", "", e -> true, null);
        entrada.adicionarAresta("Entrar na Biblioteca de Algoritmos (-10% RAM)", "biblioteca", "", e -> true, null);

        Cena biblioteca = new Cena(
            "biblioteca", "Biblioteca", "Biblioteca de Algoritmos",
            "Estantes infinitas armazenam pergaminhos binários. Um terminal antigo exibe anotações sobre bases numéricas e uma passagem leva à Estação de Energia.",
            null, false, 220, 260
        );
        biblioteca.adicionarAresta(
            "[Estudar] Decodificar Pergaminho (+20 XP)", "biblioteca", "item",
            e -> !e.inventario.contains("Pista Binária"),
            e -> {
                e.inventario.add("Pista Binária");
                e.pontos += 20;
                e.feedback = "Pista obtida: Lembre-se dos pesos binários (16 + 8 + 4 + 2 + 1)!";
                e.tipoFeedback = "sucesso";
                e.ultimoLog = "Conhecimento adquirido: Pista Binária.";
            }
        );
        biblioteca.adicionarAresta("Avançar para o Cofre Binário (-10% RAM)", "cofre", "", e -> true, null);
        biblioteca.adicionarAresta("Descer à Estação de Recarga RAM (-10% RAM)", "estacao_ram", "cura", e -> true, null);

        Cena estacaoRam = new Cena(
            "estacao_ram", "Estação RAM", "Gerador de Memória Volátil",
            "Capacitores azuis zumbem com energia pura. Aqui você pode executar o <strong>Garbage Collector</strong> para restaurar sua memória RAM ao máximo.",
            null, false, 360, 325
        );
        estacaoRam.adicionarAresta(
            "[Executar] Garbage Collector (Restaurar 100% RAM)", "estacao_ram", "cura",
            e -> e.energiaRAM < 100,
            e -> {
                e.energiaRAM = 100;
                e.feedback = "System.gc() executado! Memória RAM restaurada para 100%.";
                e.tipoFeedback = "sucesso";
                e.ultimoLog = "System.gc() -> energiaRAM = 100%";
            }
        );
        estacaoRam.adicionarAresta("Subir para o Altar da Recursão (-10% RAM)", "altar_recursao", "", e -> true, null);
        estacaoRam.adicionarAresta("Atalho para Câmara do Firewall (-10% RAM)", "sala_firewall", "", e -> true, null);

        Cena cofre = new Cena(
            "cofre", "Cofre", "Sala do Cofre Binário",
            "Um cofre blindado exige a conversão do número binário <code>10110</code> para decimal para liberar o <strong>Token Booleano</strong>.",
            "binario", false, 360, 210
        );
        cofre.adicionarAresta("Seguir para o Altar da Recursão (-10% RAM)", "altar_recursao", "", e -> true, null);

        Cena altarRecursao = new Cena(
            "altar_recursao", "Altar", "Altar da Recursão",
            "Uma inscrição brilhante pergunta: quantas vezes o laço <code>for (int i = 0; i &lt; 5; i++)</code> executa seu bloco interno?",
            "recursao", false, 510, 250
        );
        altarRecursao.adicionarAresta("Avançar para a Porta do Núcleo (-10% RAM)", "nucleo", "", e -> true, null);

        Cena corredor = new Cena(
            "corredor", "Corredor", "Corredor das Sombras",
            "Um túnel de dados sem iluminação. Ponteiros soltos faíscam nas paredes.",
            null, false, 220, 95
        );
        corredor.adicionarAresta(
            "[Coletar] Chave Hexadecimal (+25 XP)", "corredor", "item",
            e -> e.inventario.contains("Lanterna LED") && !e.inventario.contains("Chave Hexadecimal"),
            e -> {
                e.inventario.add("Chave Hexadecimal");
                e.pontos += 25;
                e.feedback = "A Lanterna revelou a Chave Hexadecimal oculta!";
                e.tipoFeedback = "sucesso";
                e.ultimoLog = "inventario.add(\"Chave Hexadecimal\")";
            }
        );
        corredor.adicionarAresta(
            "Avançar iluminado para Câmara do Firewall (-10% RAM)", "sala_firewall", "",
            e -> e.inventario.contains("Lanterna LED"), null
        );
        corredor.adicionarAresta(
            "Arriscar atravessar no escuro (Sem Lanterna)", "fim_loop", "perigo",
            e -> !e.inventario.contains("Lanterna LED"), null
        );

        Cena salaFirewall = new Cena(
            "sala_firewall", "Firewall", "Câmara do Firewall",
            "Barreiras de pacotes analisam cada byte que passa. Um terminal oferece um <strong>Escudo Antivírus</strong> para proteger sua conexão no Núcleo.",
            null, false, 410, 95
        );
        salaFirewall.adicionarAresta(
            "[Compilar] Escudo Antivírus (+25 XP)", "sala_firewall", "item",
            e -> !e.inventario.contains("Escudo Antivírus"),
            e -> {
                e.inventario.add("Escudo Antivírus");
                e.pontos += 25;
                e.feedback = "Escudo Antivírus compilado e equipado!";
                e.tipoFeedback = "sucesso";
                e.ultimoLog = "inventario.add(\"Escudo Antivírus\")";
            }
        );
        salaFirewall.adicionarAresta("Seguir para a Porta do Núcleo (-10% RAM)", "nucleo", "", e -> true, null);

        Cena nucleo = new Cena(
            "nucleo", "Núcleo", "Porta do Núcleo Central",
            "O coração do servidor! O validador verifica as credenciais armazenadas no seu <code>Set&lt;String&gt; inventario</code>.",
            null, false, 630, 175
        );
        nucleo.adicionarAresta(
            "[ACESSO ROOT] Chave + Token + Cristal Recursivo", "fim_secreto", "secreto",
            e -> e.inventario.contains("Chave Hexadecimal")
              && e.inventario.contains("Token Booleano")
              && e.inventario.contains("Cristal Recursivo"),
            e -> e.pontos += 100
        );
        nucleo.adicionarAresta(
            "[AUTENTICAR] Usar Chave Hexadecimal + Escudo", "fim_vitoria", "",
            e -> e.inventario.contains("Chave Hexadecimal")
              && e.inventario.contains("Escudo Antivírus"),
            e -> e.pontos += 50
        );
        nucleo.adicionarAresta(
            "Forçar entrada sem credenciais completas", "fim_firewall", "perigo",
            e -> true, null
        );

        GRAFO.put("entrada", entrada);
        GRAFO.put("biblioteca", biblioteca);
        GRAFO.put("estacao_ram", estacaoRam);
        GRAFO.put("cofre", cofre);
        GRAFO.put("altar_recursao", altarRecursao);
        GRAFO.put("corredor", corredor);
        GRAFO.put("sala_firewall", salaFirewall);
        GRAFO.put("nucleo", nucleo);

        GRAFO.put("fim_loop", new Cena(
            "fim_loop", "Loop", "GAME OVER: Loop Infinito",
            "Sem a Lanterna LED, você caiu em um <code>while(true)</code> sem condição de parada. A CPU travou!",
            null, true, 330, 35
        ));
        GRAFO.put("fim_firewall", new Cena(
            "fim_firewall", "Bloqueado", "GAME OVER: Conexão Recusada",
            "O Firewall detectou acesso não autorizado (<code>HTTP 403 Forbidden</code>) e encerrou seu processo.",
            null, true, 630, 45
        ));
        GRAFO.put("fim_ram", new Cena(
            "fim_ram", "OOM", "GAME OVER: OutOfMemoryError",
            "Sua memória RAM chegou a <strong>0%</strong> antes de concluir a missão! Use a Estação de Recarga na próxima tentativa.",
            null, true, 120, 325
        ));
        GRAFO.put("fim_vitoria", new Cena(
            "fim_vitoria", "Vitória", "VITÓRIA: Compilador Mestre!",
            "Você autenticou suas credenciais com sucesso e compilou o núcleo do templo!",
            null, true, 750, 235
        ));
        GRAFO.put("fim_secreto", new Cena(
            "fim_secreto", "Root", "FINAL SECRETO: Arquiteto Supremo!",
            "Incrível! Você reuniu todos os artefatos algorítmicos, resolveu os enigmas e conquistou privilégios máximos no sistema!",
            null, true, 750, 105
        ));
    }

    private static void tratarRequisicao(HttpExchange exchange) throws IOException {
        try {
            String path = exchange.getRequestURI().getPath();
            if (!path.equals("/")) {
                exchange.sendResponseHeaders(404, -1);
                return;
            }

            Map<String, String> params = lerParametros(exchange.getRequestURI().getRawQuery());

            if (params.containsKey("reset")) {
                estado = new EstadoJogo();
            } else if (params.containsKey("voltar")) {
                executarPopPilha();
            } else if (params.containsKey("enigma")) {
                processarEnigma(params.get("enigma"), params.getOrDefault("resposta", ""));
            } else if (params.containsKey("acao")) {
                int idx = Integer.parseInt(params.get("acao"));
                executarAresta(idx);
            }

            String html = renderizarHtml();
            byte[] bytes = html.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        } catch (Exception e) {
            e.printStackTrace();
            String erro = "Erro no servidor Java: " + e.getMessage();
            byte[] bytes = erro.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=UTF-8");
            exchange.sendResponseHeaders(500, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    private static void executarAresta(int indiceAresta) {
        Cena atual = GRAFO.get(estado.cenaAtual);
        if (atual == null || indiceAresta < 0 || indiceAresta >= atual.arestas.size()) return;

        Aresta escolhida = atual.arestas.get(indiceAresta);
        if (!escolhida.visivelSe.test(estado)) return;

        if (escolhida.aoExecutar != null) {
            escolhida.aoExecutar.accept(estado);
        }

        if (!escolhida.destinoId.equals(estado.cenaAtual)) {
            estado.energiaRAM -= 10;
            estado.cenaAtual = escolhida.destinoId;
            estado.visitados.add(escolhida.destinoId);
            estado.pilhaCaminho.push(escolhida.destinoId);
            estado.feedback = "Transição no grafo para [" + escolhida.destinoId + "] (-10% RAM).";
            estado.tipoFeedback = "info";
            estado.ultimoLog = "pilha.push(\"" + escolhida.destinoId + "\") | RAM = " + estado.energiaRAM + "%";

            Cena novaCena = GRAFO.get(estado.cenaAtual);
            if (estado.energiaRAM <= 0 && !novaCena.ehFinal) {
                estado.energiaRAM = 0;
                estado.cenaAtual = "fim_ram";
                estado.visitados.add("fim_ram");
                estado.ultimoLog = "EXCEÇÃO: java.lang.OutOfMemoryError!";
            }
        }
    }

    private static void executarPopPilha() {
        Cena atual = GRAFO.get(estado.cenaAtual);
        if (atual.ehFinal || estado.pilhaCaminho.size() <= 1) return;

        String removido = estado.pilhaCaminho.pop();
        String anterior = estado.pilhaCaminho.peek();
        estado.energiaRAM -= 5;
        estado.cenaAtual = anterior;
        estado.feedback = "Backtracking: pilha.pop() removeu \"" + removido + "\" (-5% RAM).";
        estado.tipoFeedback = "info";
        estado.ultimoLog = "pilha.pop() -> retornou para \"" + anterior + "\"";

        if (estado.energiaRAM <= 0) {
            estado.energiaRAM = 0;
            estado.cenaAtual = "fim_ram";
            estado.visitados.add("fim_ram");
        }
    }

    private static void processarEnigma(String tipo, String respostaBruta) {
        String resp = respostaBruta.trim();
        if ("binario".equals(tipo)) {
            if ("22".equals(resp)) {
                if (!estado.inventario.contains("Token Booleano")) {
                    estado.inventario.add("Token Booleano");
                    estado.pontos += 40;
                }
                estado.feedback = "Correto! 10110₂ = 16 + 4 + 2 = 22. Token Booleano obtido (+40 XP)!";
                estado.tipoFeedback = "sucesso";
                estado.ultimoLog = "Enigma Binário resolvido (input=\"22\" == 22) -> true";
            } else {
                estado.energiaRAM = Math.max(0, estado.energiaRAM - 15);
                estado.feedback = "Resposta incorreta (\"" + escaparHtml(resp) + "\")! O cofre drenou 15% de RAM.";
                estado.tipoFeedback = "erro";
                estado.ultimoLog = "Falha no cofre binário: input=\"" + escaparHtml(resp) + "\" != 22";
                if (estado.energiaRAM == 0) estado.cenaAtual = "fim_ram";
            }
        } else if ("recursao".equals(tipo)) {
            if ("5".equals(resp)) {
                if (!estado.inventario.contains("Cristal Recursivo")) {
                    estado.inventario.add("Cristal Recursivo");
                    estado.pontos += 40;
                }
                estado.feedback = "Exato! De i=0 até i=4 são 5 iterações. Cristal Recursivo forjado (+40 XP)!";
                estado.tipoFeedback = "sucesso";
                estado.ultimoLog = "Enigma de Laço resolvido (input=\"5\" == 5) -> true";
            } else {
                estado.energiaRAM = Math.max(0, estado.energiaRAM - 15);
                estado.feedback = "Incorreto (\"" + escaparHtml(resp) + "\")! O altar rejeitou o valor (-15% RAM).";
                estado.tipoFeedback = "erro";
                estado.ultimoLog = "Falha no Altar: input=\"" + escaparHtml(resp) + "\" != 5";
                if (estado.energiaRAM == 0) estado.cenaAtual = "fim_ram";
            }
        }
    }

    private static String renderizarHtml() throws IOException {
        Cena cena = GRAFO.get(estado.cenaAtual);

        StringBuilder botoesHtml = new StringBuilder();
        for (int i = 0; i < cena.arestas.size(); i++) {
            Aresta a = cena.arestas.get(i);
            if (a.visivelSe.test(estado)) {
                botoesHtml.append(String.format(
                    "<a class='btn %s' href='/?acao=%d'>%s</a>",
                    a.estiloCss, i, a.rotulo
                ));
            }
        }

        if (!cena.ehFinal && estado.pilhaCaminho.size() > 1) {
            botoesHtml.append("<a class='btn secundario' href='/?voltar=true'>↩ Desempilhar (pilha.pop()) - Voltar (-5% RAM)</a>");
        }
        if (cena.ehFinal) {
            botoesHtml.append("<a class='btn' href='/?reset=true'>↻ Reiniciar Sistema (new EstadoJogo())</a>");
        }

        String formHtml = "";
        if ("binario".equals(cena.tipoEnigma) && !estado.inventario.contains("Token Booleano")) {
            formHtml = "<form class='enigma-box' action='/' method='GET'>"
                     + "<input type='hidden' name='enigma' value='binario'>"
                     + "<label>Digite o valor decimal de <code>10110</code>:</label>"
                     + "<div class='input-group'>"
                     + "<input type='number' name='resposta' placeholder='Ex: 15' required>"
                     + "<button type='submit' class='btn item'>Validar</button>"
                     + "</div></form>";
        } else if ("recursao".equals(cena.tipoEnigma) && !estado.inventario.contains("Cristal Recursivo")) {
            formHtml = "<form class='enigma-box' action='/' method='GET'>"
                     + "<input type='hidden' name='enigma' value='recursao'>"
                     + "<label>Total de iterações do loop:</label>"
                     + "<div class='input-group'>"
                     + "<input type='number' name='resposta' placeholder='Ex: 4' required>"
                     + "<button type='submit' class='btn item'>Forjar</button>"
                     + "</div></form>";
        }

        StringBuilder invHtml = new StringBuilder();
        if (estado.inventario.isEmpty()) {
            invHtml.append("<span class='tag-vazia'>[ ] Nenhum item coletado</span>");
        } else {
            for (String item : estado.inventario) {
                invHtml.append("<span class='tag-item'>").append(item).append("</span>");
            }
        }

        StringBuilder pilhaHtml = new StringBuilder();
        for (String no : estado.pilhaCaminho) {
            pilhaHtml.append("<span class='stack-item'>").append(no).append("</span>");
        }

        int exploracaoPct = (int) Math.round((estado.visitados.size() * 100.0) / GRAFO.size());
        String corEnergia = estado.energiaRAM > 50 ? "#10b981" : (estado.energiaRAM > 25 ? "#f59e0b" : "#ef4444");

        String template = new String(lerArquivoRecurso("index.html"), StandardCharsets.UTF_8);
        return template
                .replace("{{TITULO}}", cena.titulo)
                .replace("{{SUBTITULO_NO}}", "Vértice: " + cena.id)
                .replace("{{TEXTO}}", cena.descricao)
                .replace("{{FEEDBACK_BANNER}}", "<div class='feedback " + estado.tipoFeedback + "'>" + estado.feedback + "</div>")
                .replace("{{FORMULARIO_ENIGMA}}", formHtml)
                .replace("{{OPCOES}}", botoesHtml.toString())
                .replace("{{ENERGIA}}", String.valueOf(estado.energiaRAM))
                .replace("{{COR_ENERGIA}}", corEnergia)
                .replace("{{PONTOS}}", String.valueOf(estado.pontos))
                .replace("{{EXPLORACAO_PCT}}", String.valueOf(exploracaoPct))
                .replace("{{INVENTARIO_HTML}}", invHtml.toString())
                .replace("{{PILHA_HTML}}", pilhaHtml.toString())
                .replace("{{SVG_MAPA}}", gerarSvgMapa())
                .replace("{{LOG_EXECUCAO}}", estado.ultimoLog);
    }

    private static String gerarSvgMapa() {
        StringBuilder svg = new StringBuilder();
        svg.append("<svg viewBox='0 0 830 370' class='mapa-svg'>");

        for (Cena origem : GRAFO.values()) {
            for (Aresta a : origem.arestas) {
                Cena destino = GRAFO.get(a.destinoId);
                if (destino == null || origem.id.equals(destino.id)) continue;
                if (destino.id.equals("fim_secreto") && !estado.visitados.contains("fim_secreto")) continue;

                boolean descoberta = estado.visitados.contains(origem.id) && estado.visitados.contains(destino.id);
                String corLinha = descoberta ? "#38bdf8" : "#334155";
                String traco = descoberta ? "" : "stroke-dasharray='5,5'";
                svg.append(String.format(
                    "<line x1='%d' y1='%d' x2='%d' y2='%d' stroke='%s' stroke-width='2' %s />",
                    origem.x, origem.y, destino.x, destino.y, corLinha, traco
                ));
            }
        }

        for (Cena c : GRAFO.values()) {
            if (c.id.equals("fim_secreto") && !estado.visitados.contains("fim_secreto")) continue;

            boolean atual = c.id.equals(estado.cenaAtual);
            boolean visitado = estado.visitados.contains(c.id);

            String preenchimento = atual ? "#10b981" : (visitado ? "#1e40af" : "#0f172a");
            String borda = atual ? "#a7f3d0" : (visitado ? "#60a5fa" : "#475569");
            String classeNo = atual ? "no-atual" : "";
            String rotulo = visitado ? c.nomeCurto : "?";

            svg.append(String.format(
                "<g class='%s'><circle cx='%d' cy='%d' r='16' fill='%s' stroke='%s' stroke-width='2.5' />"
                + "<text x='%d' y='%d' text-anchor='middle' fill='#e2e8f0' font-size='11' font-family='monospace'>%s</text></g>",
                classeNo, c.x, c.y, preenchimento, borda, c.x, c.y + 30, rotulo
            ));
        }

        svg.append("</svg>");
        return svg.toString();
    }

    private static Map<String, String> lerParametros(String rawQuery) throws IOException {
        Map<String, String> mapa = new HashMap<>();
        if (rawQuery == null || rawQuery.isEmpty()) return mapa;
        for (String par : rawQuery.split("&")) {
            String[] kv = par.split("=", 2);
            if (kv.length == 2) {
                String k = URLDecoder.decode(kv[0], "UTF-8");
                String v = URLDecoder.decode(kv[1], "UTF-8");
                mapa.put(k, v);
            }
        }
        return mapa;
    }

    private static String escaparHtml(String texto) {
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
