# Documentação do Sistema - Mídia Indoor Signage

Esta documentação descreve de forma estruturada e didática a arquitetura, o fluxo de funcionamento e a descrição dos componentes de código do sistema de sinalização digital (**Mídia Indoor Signage**), sob a ótica de administração e implantação para o cliente.

---

## 1. Visão Geral da Arquitetura

O sistema é uma solução moderna de sinalização digital indoor que permite gerenciar playlists de conteúdos (imagens e vídeos) a serem exibidos de forma contínua em telas físicas (TV Boxes, Android TVs, Smart TVs ou navegadores comuns).

A arquitetura do sistema baseia-se em três pilares principais:
1. **Front-end (Painel CMS + Player da TV):** Desenvolvido em **React**, **TypeScript** e compilado pelo **Vite**. O sistema identifica onde está rodando (se no navegador ou dentro de um aplicativo Android via **Capacitor**) e redireciona automaticamente para o painel de gerenciamento ou para a tela de exibição (Player).
2. **Back-end e Banco de Dados (Supabase):** Utiliza o **Supabase** como serviço de back-end sem servidor (BaaS), gerenciando:
   - **Autenticação de Licenças**: O login é simplificado por códigos.
   - **Banco de Dados Relacional**: PostgreSQL para armazenar registros de mídias, playlists e TVs vinculadas.
   - **Realtime**: Conexões WebSocket que notificam instantaneamente as TVs quando o administrador ou o cliente alteram a playlist no painel.
3. **Mecanismo de Cache Offline:** Uma funcionalidade embutida no Player da TV que faz o download prévio dos arquivos de vídeo e imagem para o armazenamento interno da TV Box. Caso a internet caia temporariamente, a sinalização não é interrompida e as mídias salvas continuam rodando.

---

## 2. Estrutura de Arquivos e Como Funcionam (Ponto a Ponto)

Abaixo estão explicados os arquivos estruturais e os componentes lógicos da aplicação:

### A. Banco de Dados e Regras (`supabase/migrations/`)
Esta pasta contém os scripts SQL executados no Supabase para montar a estrutura do banco de dados e garantir a segurança das informações.
*   **`20260623000000_schema.sql` (Estrutura Principal):**
    *   **`licencas`**: Controla as chaves de acesso dos clientes, o vencimento e o status da conta.
    *   **`midias`**: Tabela que armazena os metadados dos arquivos enviados (nome, tipo, tamanho e a URL de acesso).
    *   **`playlists`**: Agrupadores lógicos de mídias. Cada licença de cliente pode criar várias playlists, mas apenas uma estará ativa na TV por vez.
    *   **`playlist_itens`**: Tabela de associação (Muitos-para-Muitos) que define a sequência de mídias de uma playlist, incluindo a ordem e a duração de exibição (para imagens).
    *   **`tvs`**: Registra cada aparelho (TV Box/Android TV) pareado. Salva a orientação da tela e o status de conexão.
    *   **Políticas de RLS (Row Level Security)**: Garante de forma rígida que um cliente autenticado só consiga ler ou modificar as mídias e playlists vinculadas à sua própria licença.
    *   **Funções Auxiliares (RPC)**:
        *   `criar_licenca`: Função administrativa usada para criar novos usuários e gerar tokens.
        *   `vincular_tv_por_playlist`: Associa uma nova TV utilizando o código rápido de uma playlist.
*   **`20260623000002_admin_and_limits.sql`:**
    *   Cria o perfil do Administrador Master do sistema (`vini2fernandes@gmail.com`) com acesso irrestrito às licenças.
    *   Configura limites personalizados de playlists por cliente (ex: padrão de 10 playlists).
*   **Outros arquivos de migração** definem regras como permissões de edição de tokens do cliente e conversão de credenciais para letras minúsculas (evitando erros de digitação ao fazer login).

### B. Arquivos de Configuração e Entrada
*   **`package.json`**: Declara as dependências do projeto (React 18, React Router Dom, Capacitor para Android, Supabase JS, TailwindCSS para estilização premium e Lucide-react para ícones).
*   **`capacitor.config.ts`**: Configurações que geram o instalador nativo Android (`.apk`), habilitando o player para rodar em tela cheia nas TV Boxes sem a necessidade de barras de navegação visíveis.
*   **`src/lib/supabase.ts`**: Inicializa a comunicação com a API do Supabase utilizando as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Possui tratamento de erro amigável caso as variáveis não tenham sido configuradas no servidor.

### C. Lógica e Componentes de Interface (`src/`)
*   **`src/hooks/useMediaCache.ts` (Mecanismo Offline):**
    *   Responsável pela alta disponibilidade do sistema.
    *   Ao ler a playlist de mídia, este hook verifica os arquivos necessários e gerencia a **Cache Storage API** do navegador.
    *   Se um vídeo ou imagem já foi baixado anteriormente, ele o lê do armazenamento local da TV (gerando um Object URL temporário do tipo `blob:`).
    *   Se for um arquivo novo, realiza o download em segundo plano e o adiciona ao cache.
    *   Ignora links externos dinâmicos como streams do YouTube que requerem conexão de internet direta para reprodução.
*   **`src/components/cms/` (Componentes do Painel do Cliente):**
    *   **`PlaylistBuilder.tsx`**: Tela interativa onde o cliente cria playlists, adiciona mídias da biblioteca, arrasta e reordena os itens (cima/baixo) e edita a duração das imagens.
    *   **`MediaUpload.tsx`**: Responsável pelo envio de novas imagens ou vídeos, convertendo os arquivos em URLs do Supabase Storage.
*   **`src/App.tsx` (Arquivo Central do Sistema):**
    *   Este arquivo contém a estrutura base de rotas da aplicação (`/login`, `/`, `/tv`, `/admin`). Devido à arquitetura enxuta, ele engloba sub-dashboards em blocos de código integrados para reduzir a latência de carregamento:
        1.  **`AuthProvider`**: Contexto global de autenticação. Realiza a validação periódica da licença do cliente (a cada 30 segundos) para desconectar imediatamente TVs ou painéis caso a assinatura expire ou seja suspensa.
        2.  **`CMSLogin`**: Tela de entrada estilizada (com efeitos visuais modernos e responsivos) para acesso ao painel CMS.
        3.  **`CMSDashboard`**: Painel administrativo do cliente, onde ele gerencia suas playlists, sobe arquivos de vídeo/imagem, adiciona links do YouTube, monitora quais TVs estão ativas e gerencia a rotação de suas telas.
        4.  **`AdminDashboard`**: Painel exclusivo do administrador master do sistema para criar novos clientes, suspender licenças e configurar limites de uso.
        5.  **`TVPlayer`**: A interface que roda na TV Box. Exibe um fluxo de pareamento com código PIN em 3 etapas e, uma vez pareado, renderiza o componente `ActivePlayer` para executar os vídeos e imagens em tela cheia com transições limpas.

---

## 3. Fluxo de Operação do Cliente (Como o Sistema Funciona)

### Passo 1: Login e Autenticação
O cliente acessa a URL do sistema (ou o aplicativo no celular/computador) e digita o seu **Código de Ativação / Licença**. O sistema realiza o login utilizando um e-mail virtualizado (`codigo@midia.indoor`) de forma invisível para o usuário final, poupando a necessidade de lembrar de senhas complexas.

### Passo 2: Gerenciamento e Upload de Mídia
No painel de controle, o cliente pode:
1.  Fazer upload de imagens (**JPG/PNG**) ou vídeos (**MP4** com codec H.264 recomendado).
2.  Adicionar links diretos de vídeos públicos do **YouTube**.
3.  O sistema automaticamente exibe alertas para lembrar o cliente de evitar arquivos muito pesados ou com qualidades excessivas (como 4K a 60fps) que travariam TV Boxes comerciais modestas.

### Passo 3: Criação de Playlists
O cliente organiza suas mídias criando Playlists.
*   Pode configurar tempos de exibição específicos para cada imagem (ex: Foto 1 passa por 5 segundos, Foto 2 por 15 segundos).
*   Vídeos rodam automaticamente até o final antes de pular para o próximo item.
*   O sistema soma os tamanhos dos arquivos para o cliente saber o consumo de dados da playlist.

### Passo 4: Pareamento de TVs
Para conectar uma tela na loja física do cliente:
1.  Abre-se a rota `/tv` do app no aparelho da loja.
2.  Um ID exclusivo do dispositivo é gerado e o aparelho entra em modo de espera.
3.  No painel de controle (CMS), o cliente clica no ícone da TV na playlist correspondente, onde verá o código de pareamento.
4.  Ao digitar o código correspondente no player da TV Box, a vinculação é selada no banco de dados em tempo real.
5.  A TV Box começará a rodar a playlist em loop. Se o painel alterar a playlist, a TV se atualiza imediatamente.
6.  O painel permite definir o sentido da tela (Horizontal, Vertical, Horizontal Invertido, Vertical Invertido) e o player da TV gira fisicamente a exibição sem a necessidade de mexer nas configurações físicas do aparelho de TV.

---

## 4. Respostas aos Questionamentos Técnicos e de Negócio

### A. Programação Semanal Automática (Escolher dias específicos para a mídia passar)
> **Dúvida:** *"É possível na playlist eu definir que dia eu quero que passe o vídeo/item? Quero que esse vídeo só apareça segunda-feira automaticamente."*

**Sim, isso é totalmente viável!** Abaixo está o detalhamento de como a funcionalidade deve ser modelada para funcionar no sistema atual:

1.  **Mudança no Banco de Dados (Migration):**
    Adicionamos na tabela `playlist_itens` um campo para marcar os dias da semana selecionados (onde `0 = Domingo, 1 = Segunda, ..., 6 = Sábado`). Isso pode ser feito como um array de inteiros (`dias_semana integer[] DEFAULT '{0,1,2,3,4,5,6}'`) ou colunas booleanas individuais para cada dia da semana (`domingo boolean DEFAULT true`, `segunda boolean DEFAULT true`, etc.).
2.  **Interface de Configuração no CMS (PlaylistBuilder):**
    No modal de edição do item da playlist (`handleEditItem`), adicionamos 7 pequenas caixas de marcação (Checkboxes) contendo as iniciais dos dias da semana (D, S, T, Q, Q, S, S). O usuário marca os dias desejados e o valor é persistido na tabela de associação.
3.  **Funcionamento no Player da TV (`TVPlayer`):**
    No loop de execução, o script do player obterá o dia da semana local do dispositivo:
    ```javascript
    const diaAtual = new Date().getDay(); // Ex: 1 para segunda-feira
    ```
    Antes de renderizar o item atual, o player verifica se o `diaAtual` está listado nos dias ativos do arquivo. Se não estiver, ele pula silenciosamente para o próximo item da fila, sem renderizá-lo na tela.
    *   **Vantagem**: O cliente não precisa subir ou apagar mídias manualmente toda semana. O player faz a triagem sozinho localmente. Como os arquivos já estão salvos no cache físico da TV Box, ele continuará funcionando perfeitamente mesmo sem internet ativa naquele dia.

---

### B. Limitação de Espaço do Supabase (0.5 GB) vs Hospedagem Externa (Nitroflare de 10TB)
> **Dúvida:** *"O Supabase livre tem só 0.5G. Por que não usar um drive como Nitroflare que eu tenho 10T? Na hora de atualizar mídias, a atualização não seria rápida?"*

Esta é uma preocupação muito válida. Hospedar vídeos de sinalização indoor consome muito espaço e banda. Abaixo explicamos as vantagens, desvantagens e soluções práticas para esta dinâmica de armazenamento:

#### 1. O Problema do Nitroflare (e drives comerciais semelhantes)
Para que o player do navegador ou da TV Box reproduza um vídeo/imagem, o sistema de arquivos precisa de uma **URL de Download Direto** (também conhecida como *Hotlink* ou link direto para o arquivo bruto).
*   ** Nitroflare e afins** são servidores de compartilhamento de arquivos com foco em downloads tradicionais. Geralmente, esses links expiram após algumas horas, são restritos pelo IP de quem gerou o link ou exibem páginas intermediárias com publicidade, captchas e tempos de espera antes de liberar o arquivo.
*   Se o player tentar ler um link não-direto, a tag HTML5 `<video src="URL">` irá falhar e o cache offline não conseguirá fazer o download do vídeo.
*   **Quando funcionaria?** Apenas se você possuir uma conta premium do Nitroflare e o serviço disponibilizar uma ferramenta de geração de links diretos permanentes sem restrição de CORS (Cross-Origin Resource Sharing).

#### 2. Alternativas Baratas e Robustas de Alta Capacidade
Para resolver a limitação de 0.5 GB sem as dificuldades dos drives de download tradicionais, a indústria utiliza soluções de armazenamento de objetos compatíveis com **S3**:
*   **Cloudflare R2 (Altamente Recomendado):**
    *   **Espaço Grátis:** Oferece **10 GB gratuitos** de armazenamento.
    *   **Diferencial de Ouro:** Não cobra taxas de tráfego de saída (Download/Egress). Ou seja, suas TVs podem baixar os vídeos centenas de vezes e a sua fatura continuará em R$ 0,00.
    *   **Preço Adicional:** Acima de 10 GB, custa apenas US$ 0.015 por GB (cerca de R$ 0,08 por giga).
    *   Ele gera URLs diretas permanentes que atualizam instantaneamente.
*   **Backblaze B2:**
    *   **Espaço Grátis:** Oferece **10 GB gratuitos**. O tráfego de saída é muito barato.
*   **Servidor Próprio (Hospedagem VPS):**
    *   Se você hospeda o sistema em uma VPS (como Contabo, DigitalOcean, etc.), você pode anexar discos de armazenamento e servir as mídias diretamente do seu próprio servidor web (ex: `https://seu-sistema.com/uploads/video.mp4`), eliminando limites de armazenamento de terceiros.

#### 3. Como seria o funcionamento técnico usando links externos
O sistema atual **já está preparado** para lidar com arquivos hospedados fora do Supabase. A tabela `midias` grava a URL do arquivo no campo `url_arquivo` como texto simples.
*   Ao cadastrar uma mídia, você pode ignorar o upload do Supabase e simplesmente preencher o campo `url_arquivo` com o link direto gerado pelo seu Nitroflare, Cloudflare R2 ou qualquer outro servidor externo.
*   **A atualização continua rápida?**
    *   **Sim!** A velocidade de propagação e comando é comandada pelo banco de dados do Supabase. Quando uma mídia externa é alterada ou removida de uma playlist, o canal de comunicação Realtime avisa a TV imediatamente (dentro de milissegundos). A TV recebe a notificação, apaga o cache antigo e inicia o download da nova URL externa de forma transparente.
    *   A única diferença física será o tempo que a TV Box levará para transferir o arquivo do seu servidor externo para a memória interna local dela, dependendo da velocidade da rede.
