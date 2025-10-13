'use client'
import { useEffect, useState } from "react";
import {
  AbsoluteCenter,
  Box,
  VStack,
  Image,
  Button,
  Heading,
  SimpleGrid,
  Text,
  Input,
  HStack,
  Spinner,
} from "@chakra-ui/react";
import { db } from "./firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";

export default function Home() {
  // --- Estados do Jogo ---
  const [jogadores, setJogadores] = useState([]);
  const [opcoes, setOpcoes] = useState([]);
  const [donoImagem, setDonoImagem] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [resposta, setResposta] = useState(null);
  const [erroJogo, setErroJogo] = useState(null);
  const [gameMode, setGameMode] = useState('normal'); 

  // --- Estados do Usuário e Login ---
  const [cpfInput, setCpfInput] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // --- Estados de Tentativas e Fim de Jogo ---
  const [tentativas, setTentativas] = useState(0);
  const [fimDeJogo, setFimDeJogo] = useState(false);
  const [jogadoresJaSorteados, setJogadoresJaSorteados] = useState([]);
  const [maxTentativas, setMaxTentativas] = useState(20);

  // --- Funções Utilitárias ---
  const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
  const cleanCpf = (cpf) => (cpf || "").replace(/\D/g, "");
  const maskCPF = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .substring(0, 14);
  };

  // --- Lógica Principal do Jogo ---

  const carregarJogadoresNormais = async (empresaDoUsuario, idDoUsuario) => {
    setCarregando(true);
    setErroJogo(null);
    try {
      const qEmpresa = query(
        collection(db, "cadastros"),
        where("empresa", "==", empresaDoUsuario)
      );
      const qImgFinal = query(
        collection(db, "cadastros"),
        where("imgFinal", "==", true)
      );

      const [empresaSnapshot, imgFinalSnapshot] = await Promise.all([
        getDocs(qEmpresa),
        getDocs(qImgFinal),
      ]);

      const listaDaEmpresa = empresaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const listaImgFinal = imgFinalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const jogadoresUnicos = new Map();
      listaDaEmpresa.forEach(jogador => jogadoresUnicos.set(jogador.id, jogador));
      listaImgFinal.forEach(jogador => jogadoresUnicos.set(jogador.id, jogador));

      const listaCombinada = Array.from(jogadoresUnicos.values());

      const listaFinal = listaCombinada
        .filter((jogador) => jogador.imageUrl && jogador.genero)
        .filter((jogador) => jogador.id !== idDoUsuario);

      if (listaFinal.length < 4) {
        setErroJogo(`Não há jogadores suficientes para iniciar (mínimo: 4).`);
      } else {
        setJogadores(listaFinal);
      }
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
      setErroJogo("Ocorreu um erro ao carregar os dados do jogo.");
    } finally {
      setCarregando(false);
    }
  };

  // #############################################################
  // ##           FUNÇÃO PRINCIPAL COM A LÓGICA ALTERADA        ##
  // #############################################################
  const carregarJogadoresDaFinal = async (idDoUsuario) => {
    setCarregando(true);
    setErroJogo(null);
    try {
      // Busca 1: Funcionários da Simetria com score 20
      const qSimetria = query(
        collection(db, "cadastros"),
        where("empresa", "==", "Simetria"),
        where("score", "==", 20)
      );
      
      // Busca 2: Funcionários da GC com score 7
      const qGC = query(
        collection(db, "cadastros"),
        where("empresa", "==", "GC"),
        where("score", "==", 7)
      );

      // Busca 3: TODOS os funcionários com imgFinal = true
      const qImgFinal = query(
        collection(db, "cadastros"),
        where("imgFinal", "==", true)
      );

      const [simetriaSnapshot, gcSnapshot, imgFinalSnapshot] = await Promise.all([
        getDocs(qSimetria),
        getDocs(qGC),
        getDocs(qImgFinal)
      ]);

      // Coleta os resultados
      const listaSimetria = simetriaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const listaGC = gcSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const listaImgFinal = imgFinalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Junta as três listas e remove duplicados usando um Map
      const finalistasUnicos = new Map();
      listaSimetria.forEach(jogador => finalistasUnicos.set(jogador.id, jogador));
      listaGC.forEach(jogador => finalistasUnicos.set(jogador.id, jogador));
      listaImgFinal.forEach(jogador => finalistasUnicos.set(jogador.id, jogador));

      const finalistas = Array.from(finalistasUnicos.values())
        .filter(jogador => jogador.imageUrl && jogador.genero)
        .filter(jogador => jogador.id !== idDoUsuario);

      if (finalistas.length < 4) {
        setErroJogo(`Não há finalistas suficientes para iniciar a rodada final (mínimo: 4).`);
      } else {
        setJogadores(finalistas);
        // Define o número de tentativas como o total de finalistas
        setMaxTentativas(finalistas.length); 
        setTentativas(0);
        setCurrentUser(prev => ({...prev, score: 0}));
        setJogadoresJaSorteados([]);
        setFimDeJogo(false);
      }
    } catch (error) {
      console.error("Erro ao carregar finalistas:", error);
      setErroJogo("Ocorreu um erro ao carregar os finalistas. Verifique se os índices do Firestore foram criados.");
    } finally {
      setCarregando(false);
    }
  };
  
  const handleIniciarFinal = async () => {
    setGameMode('final');
    await carregarJogadoresDaFinal(currentUser.id);
  };

  const gerarRodada = () => {
    if (jogadores.length === 0) return;

    const jogadoresNaoUsadosComoImagem = jogadores.filter(
      (j) => !jogadoresJaSorteados.includes(j.id)
    );

    if (jogadoresNaoUsadosComoImagem.length === 0) {
      setErroJogo("Você adivinhou todos os jogadores. Parabéns!");
      setFimDeJogo(true);
      return;
    }

    const escolhido = shuffle(jogadoresNaoUsadosComoImagem)[0];
    const opcoesPossiveis = jogadores.filter((j) => j.id !== escolhido.id);
    const opcoesSorteadas = shuffle(opcoesPossiveis).slice(0, 3);
    const sorteados = shuffle([escolhido, ...opcoesSorteadas]);

    setOpcoes(sorteados);
    setDonoImagem(escolhido);
    setResposta(null);
    setJogadoresJaSorteados((prev) => [...prev, escolhido.id]);
  };

  useEffect(() => {
    if (jogadores.length > 0 && !fimDeJogo) {
        gerarRodada();
    }
  }, [jogadores, fimDeJogo]);

  const handleLoginByCpf = async (e) => {
    e?.preventDefault();
    if(authenticating) return;
    setAuthenticating(true);

    const cpfLimpo = cleanCpf(cpfInput);
    if (!cpfLimpo) { return setAuthenticating(false); }

    try {
      const q = query(collection(db, "cadastros"), where("cpf", "==", cpfLimpo));
      const qs = await getDocs(q);

      if (qs.empty) { return setAuthenticating(false); }

      const userDoc = qs.docs[0];
      const userData = { id: userDoc.id, ...userDoc.data() };
      
      const limiteDeTentativas = userData.empresa === 'GC' ? 7 : 20;
      setMaxTentativas(limiteDeTentativas);
      
      const scoreAtual = userData.score ?? 0;
      const tentativasJogadas = userData.tentativasJogadas ?? 0;

      setCurrentUser({ ...userData, score: scoreAtual });
      
      if (tentativasJogadas >= limiteDeTentativas) {
        setFimDeJogo(true);
        setAuthenticating(false);
        return;
      }

      setGameMode('normal');
      setJogadoresJaSorteados([]);
      setTentativas(tentativasJogadas);
      setFimDeJogo(false);
      await carregarJogadoresNormais(userData.empresa, userData.id);

    } catch (error) {
      console.error("Erro ao logar por CPF:", error);
    } finally {
      setAuthenticating(false);
    }
  };

  const verificarResposta = async (id) => {
    if (resposta || fimDeJogo) return;

    const acertou = id === donoImagem.id;
    setResposta(acertou ? "acerto" : "erro");
    
    const novaPontuacao = acertou ? (currentUser.score ?? 0) + 1 : (currentUser.score ?? 0);
    const novaTentativa = tentativas + 1;

    if (gameMode === 'normal') {
        try {
            const userRef = doc(db, "cadastros", currentUser.id);
            await updateDoc(userRef, { score: novaPontuacao, tentativasJogadas: novaTentativa });
        } catch (err) {
            console.error("Erro ao atualizar dados:", err);
        }
    }

    setCurrentUser((prev) => ({ ...prev, score: novaPontuacao }));
    setTentativas(novaTentativa);

    if (novaTentativa >= maxTentativas) {
      setFimDeJogo(true);
    } else {
      setTimeout(() => gerarRodada(), 1500);
    }
  };
  
    useEffect(() => {
    if (fimDeJogo && gameMode === 'final' && currentUser) {
      const salvarPontuacaoDaFinal = async () => {
        const pontuacaoDaFinal = currentUser.score;
        const userRef = doc(db, "cadastros", currentUser.id);

        try {
          await updateDoc(userRef, {
            scoreFinal: pontuacaoDaFinal,
          });
          console.log("Pontuação da final salva no banco de dados:", pontuacaoDaFinal);
        } catch (error) {
          console.error("Erro ao salvar a pontuação da final no banco:", error);
        }
      };

      salvarPontuacaoDaFinal();
    }
  }, [fimDeJogo, gameMode, currentUser]);

  // --- Renderização ---

  if (carregando) {
    return ( <AbsoluteCenter><VStack><Spinner size="xl" /><Heading mt={4}>Carregando...</Heading></VStack></AbsoluteCenter> );
  }

  if (erroJogo && !fimDeJogo) {
    return (
      <AbsoluteCenter textAlign="center" p={8}>
        <Heading size="md">Opa!</Heading>
        <Text mt={4}>{erroJogo}</Text>
      </AbsoluteCenter>
    )
  }

  if (!currentUser) {
    return (
      <AbsoluteCenter px={{ base: 4, md: 8 }} w="100%">
        <Box p={{ base: 4, md: 8 }} w={{ base: "100%", md: "520px" }} borderRadius="lg" shadow="lg">
          <VStack spacing={6}>
            <Heading size="lg">Quem sou eu?</Heading>
            <Text textAlign="center">Informe seu CPF para iniciar o jogo.</Text>
            <form style={{ width: "100%" }} onSubmit={handleLoginByCpf}>
              <VStack spacing={4}>
                <Input placeholder="000.000.000-00" value={cpfInput} onChange={(e) => setCpfInput(maskCPF(e.target.value))} />
                <Button type="submit" colorScheme="blue" isLoading={authenticating} loadingText="Verificando..." w="100%">Entrar</Button>
              </VStack>
            </form>
          </VStack>
        </Box>
      </AbsoluteCenter>
    );
  }

  if (fimDeJogo) {
    const pontuacaoFinal = currentUser.score;
    const qualificadoParaFinal = gameMode === 'normal' && (
      (currentUser.empresa === 'Simetria' && pontuacaoFinal >= 20) ||
      (currentUser.empresa === 'GC' && pontuacaoFinal >= 7)
    );

    return (
      <AbsoluteCenter px={{ base: 4, md: 8 }} w={"100%"}>
        <Box p={{ base: 4, md: 8 }} w={{ base: "100%", md: "520px" }} borderRadius="lg" shadow="lg" textAlign="center">
          <VStack spacing={6}>
            <Heading size="xl">
              {gameMode === 'normal' ? 'Fim de Jogo!' : 'Fim da Final!'}
            </Heading>
            
            {erroJogo && <Text color="gray.500">{erroJogo}</Text>}

            <Text fontSize="lg" mt={4}>
              {gameMode === 'normal' ? 'Sua pontuação foi:' : 'Sua pontuação na final foi:'}
            </Text>
            <Heading size="3xl" color="blue.500">{pontuacaoFinal}</Heading>

            {qualificadoParaFinal ? (
              <>
                <Text fontSize="md" color="green.600" pt={4}>Parabéns! Você se classificou para a Rodada Final!</Text>
                <Button onClick={handleIniciarFinal} size={"lg"} colorScheme="green" width={"100%"}>
                  Jogar a Final
                </Button>
              </>
            ) : (
              <Text fontSize="md" color="gray.600" pt={4}>Obrigado por jogar!</Text>
            )}
          </VStack>
        </Box>
      </AbsoluteCenter>
    );
  }

  return (
    <AbsoluteCenter px={{ base: 4, md: 8 }} w={"100%"}>
      <Box p={{ base: 0, md: 8 }} w={{ base: "100%", md: "720px" }}>
        <VStack spacing={6} align="stretch">
          <HStack justify="space-between" align="center">
            <Heading size="lg" color="green.500">{gameMode === 'final' && 'RODADA FINAL'}</Heading>
            <Box textAlign="right">
              <Text fontSize="sm">Jogador</Text>
              <Text fontWeight="bold">{currentUser.nomeCompleto}</Text>
              <Text fontSize="sm">Pontuação: {currentUser.score ?? 0}</Text>
              <Text fontSize="sm" color="gray.500">Rodada: {tentativas + 1}/{maxTentativas}</Text>
            </Box>
          </HStack>
          <VStack spacing={4} align="center">
            <Heading size="3xl" mb={10}>QUEM SOU EU?</Heading>
            <Box
              boxSize={{ base: "260px", md: "320px" }}
              borderRadius="xl"
              shadow="lg"
              overflow="hidden"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="gray.100"
            >
              <Image
                src={donoImagem?.imageUrl}
                alt="Foto misteriosa"
                objectFit="contain"
                maxW="100%"
                maxH="100%"
              />
            </Box>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} w="100%">
              {opcoes.map((item) => (
                <Button textTransform={"uppercase"} key={item.id} variant="outline" size="lg" w="100%" onClick={() => verificarResposta(item.id)} isDisabled={!!resposta}
                  colorScheme={ resposta && item.id === donoImagem.id ? "green" : resposta && item.id !== donoImagem.id ? "red" : "gray" }>
                  {item.nomeCompleto}
                </Button>
              ))}
            </SimpleGrid>
            {resposta && (
              <Text fontSize="xl" color={resposta === "acerto" ? "green.500" : "red.500"}>
                {resposta === "acerto" ? "✅ Você acertou!" : "❌ Você errou!"}
              </Text>
            )}
          </VStack>
        </VStack>
      </Box>
    </AbsoluteCenter>
  );
}