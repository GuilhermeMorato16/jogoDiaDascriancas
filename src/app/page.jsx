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
import { toaster } from "@/components/ui/toaster"; // Supondo que seu toaster Ark UI esteja configurado

export default function Home() {
  // --- Estados do Jogo ---
  const [jogadores, setJogadores] = useState([]);
  const [opcoes, setOpcoes] = useState([]);
  const [donoImagem, setDonoImagem] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [resposta, setResposta] = useState(null);
  const [erroJogo, setErroJogo] = useState(null); // Para feedback se não houver jogadores

  // --- Estados do Usuário e Login ---
  const [cpfInput, setCpfInput] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // --- Estados de Tentativas e Fim de Jogo ---
  const [tentativas, setTentativas] = useState(0);
  const [fimDeJogo, setFimDeJogo] = useState(false);
  const [bonus, setBonus] = useState(false);
  const [usandoBonus, setUsandoBonus] = useState(false);
  const MAX_TENTATIVAS = 10;

  // --- Funções Utilitárias ---
  const shuffle = (array) => array.sort(() => Math.random() - 0.5);
  const cleanCpf = (cpf) => (cpf || "").replace(/\D/g, "");

  // --- Lógica Principal do Jogo ---

  const carregarJogadores = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "cadastros"));
      
      const lista = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((jogador) => jogador.imageUrl);

      // Valida se há jogadores suficientes para o jogo começar
      if (lista.length > 0 && lista.length < 4) {
       console.log(lista)
        setErroJogo("É necessário ter pelo menos 4 jogadores cadastrados com foto para o jogo começar.");
      } else if (lista.length === 0) {
        setErroJogo("Nenhum jogador com foto encontrado. Cadastre mais participantes!");
      } else {
        setErroJogo(null); // Limpa o erro se houver jogadores
        setJogadores(lista);
      }
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
      setErroJogo("Ocorreu um erro ao carregar os dados do jogo.");
    } finally {
      setCarregando(false);
    }
  };

  const gerarRodada = () => {
    if (jogadores.length < 4) return;
    const sorteados = shuffle([...jogadores]).slice(0, 4);
    const escolhido = sorteados[Math.floor(Math.random() * 4)];
    setOpcoes(sorteados);
    setDonoImagem(escolhido);
    setResposta(null);
  };

  useEffect(() => {
    carregarJogadores();
  }, []);

  useEffect(() => {
    if (jogadores.length > 0) gerarRodada();
  }, [jogadores]);

  const handleLoginByCpf = async (e) => {
    e?.preventDefault();
    if (authenticating) return;
    setAuthenticating(true);

    const cpfLimpo = cleanCpf(cpfInput);
    if (!cpfLimpo) {
      toaster.create({ title: "CPF inválido", type: "warning" });
      setAuthenticating(false);
      return;
    }

    try {
      const q = query(collection(db, "cadastros"), where("cpf", "==", cpfLimpo));
      const qs = await getDocs(q);

      if (qs.empty) {
        toaster.create({ title: "CPF não encontrado", type: "error" });
        setAuthenticating(false);
        return;
      }

      const userDoc = qs.docs[0];
      const userData = { id: userDoc.id, ...userDoc.data() };
      
      userData.score = userData.score ?? 0;
      userData.tentativasJogadas = userData.tentativasJogadas ?? 0;
      userData.possuiBonus = userData.possuiBonus ?? false;
      setBonus(userData.possuiBonus);

      setCurrentUser(userData);

      if (userData.tentativasJogadas >= MAX_TENTATIVAS) {
        setFimDeJogo(true);
        return;
      }

      setTentativas(userData.tentativasJogadas);
      setFimDeJogo(false);
      toaster.create({
        title: "Bem-vindo!",
        description: `Olá, ${userData.nomeCompleto}. Boa sorte!`,
        type: "success",
      });
    } catch (error) {
      console.error("Erro ao logar por CPF:", error);
      toaster.create({ title: "Erro ao buscar CPF", type: "error" });
    } finally {
      setAuthenticating(false);
    }
  };

  const handleJogarNovamenteComBonus = async () => {
    if (usandoBonus) return;
    setUsandoBonus(true);

    try {
      const userRef = doc(db, "cadastros", currentUser.id);
      await updateDoc(userRef, {
        tentativasJogadas: 0,
        possuiBonus: false,
      });
      
      setTentativas(0);
      setFimDeJogo(false);
      setBonus(false);
      setCurrentUser((prev) => ({ ...prev, tentativasJogadas: 0, possuiBonus: false }));
      
      toaster.create({ title: "Segunda chance!", description: "Suas tentativas foram resetadas.", type: "success" });
      gerarRodada();
    } catch (err) {
      console.error("Erro ao usar o bônus:", err);
      toaster.create({ title: "Erro", description: "Não foi possível usar o bônus.", type: "error" });
    } finally {
      setUsandoBonus(false);
    }
  };

  const verificarResposta = async (id) => {
    if (resposta || fimDeJogo) return;
    if (!currentUser) return;

    const acertou = id === donoImagem.id;
    setResposta(acertou ? "acerto" : "erro");
    toaster.create({ title: acertou ? "🎉 Acertou!" : "❌ Errou!", type: acertou ? "success" : "error", duration: 1500 });

    const novaPontuacao = acertou ? (currentUser.score ?? 0) + 1 : (currentUser.score ?? 0);
    const novaTentativa = tentativas + 1;

    try {
      const userRef = doc(db, "cadastros", currentUser.id);
      await updateDoc(userRef, { score: novaPontuacao, tentativasJogadas: novaTentativa });
      setCurrentUser((prev) => ({ ...prev, score: novaPontuacao, tentativasJogadas: novaTentativa }));
      setTentativas(novaTentativa);
    } catch (err) {
      console.error("Erro ao atualizar dados:", err);
    }

    if (novaTentativa >= MAX_TENTATIVAS) {
      setFimDeJogo(true);
    } else {
      setTimeout(() => gerarRodada(), 1500);
    }
  };

  // --- Renderização Condicional ---

  if (carregando) {
    return ( <AbsoluteCenter><VStack><Spinner /><Heading>Carregando...</Heading></VStack></AbsoluteCenter> );
  }

  if (erroJogo) {
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
            <Heading size="lg">Entrar com CPF</Heading>
            <Text textAlign="center">Informe o CPF cadastrado para jogar.</Text>
            <form style={{ width: "100%" }} onSubmit={handleLoginByCpf}>
              <VStack spacing={4}>
                <Input placeholder="000.000.000-00" value={cpfInput} onChange={(e) => setCpfInput(e.target.value)} />
                <Button type="submit" colorScheme="blue" isLoading={authenticating} loadingText="Verificando..." w="100%">Entrar</Button>
              </VStack>
            </form>
          </VStack>
        </Box>
      </AbsoluteCenter>
    );
  }
  
  if (fimDeJogo) {
    return (
      <AbsoluteCenter px={{ base: 4, md: 8 }} w={"100%"}>
        <Box p={{ base: 4, md: 8 }} w={{ base: "100%", md: "520px" }} borderRadius="lg" shadow="lg" textAlign="center">
          <VStack spacing={6}>
            <Heading size="xl">Fim de Jogo!</Heading>
            <Text fontSize="lg" mt={4}>Sua pontuação final foi:</Text>
            <Heading size="3xl" color="blue.500">{currentUser.score}</Heading>
            {bonus ? (
              <>
                <Text fontSize="md" color="gray.600" pt={4}>Você cadastrou uma foto e ganhou uma chance extra!</Text>
                <Button onClick={handleJogarNovamenteComBonus} isLoading={usandoBonus} loadingText="Aguarde..." size={"lg"} colorScheme="blue" width={"100%"}>
                  Jogar novamente
                </Button>
              </>
            ) : (
              <Text fontSize="md" color="gray.600" pt={4}>Você já completou todas as suas tentativas.</Text>
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
            <Heading size="lg"></Heading>
            <Box textAlign="right">
              <Text fontSize="sm">Jogador</Text>
              <Text fontWeight="bold">{currentUser.nomeCompleto}</Text>
              <Text fontSize="sm">Pontuação: {currentUser.score ?? 0}</Text>
              <Text fontSize="sm" color="gray.500">Rodada: {tentativas + 1}/{MAX_TENTATIVAS}</Text>
            </Box>
          </HStack>
          <VStack spacing={4} align="center">
            <Heading size="3xl" mb={10}>QUEM SOU EU?</Heading>
            <Image src={donoImagem?.imageUrl} alt="Foto misteriosa" borderRadius="xl" boxSize={{ base: "260px", md: "320px" }} objectFit="cover" shadow="lg"/>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} w="100%">
              {opcoes.map((item) => (
                <Button key={item.id} variant="outline" size="lg" w="100%" onClick={() => verificarResposta(item.id)} isDisabled={!!resposta}
                  colorScheme={ resposta && item.id === donoImagem.id ? "green" : resposta && item.id !== donoImagem.id ? "red" : "blue" }>
                  {item.nomeCompleto}
                </Button>
              ))}
            </SimpleGrid>
            {resposta && (
              <Text fontSize="xl" color={resposta === "acerto" ? "green.400" : "red.400"}>
                {resposta === "acerto" ? "✅ Você acertou!" : "❌ Você errou!"}
              </Text>
            )}
          </VStack>
        </VStack>
      </Box>
    </AbsoluteCenter>
  );
}