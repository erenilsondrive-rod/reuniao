let participantes = [];
let githubConfig = {
    user: '',
    repo: '',
    branch: 'main',
    path: 'presencas.json',
    token: ''
};

let reuniaoInfo = {
    tema: 'ATA DE PRESENÇA DA REUNIÃO',
    local: '',
    data: '',
    horario: ''
};

const PALAVRAS_BANIDAS = ["PALAVRAO1", "PALAVRAO2", "OBSCENO", "TESTE123"];

function contemObscenidade(texto) {
    if (!texto) return false;
    const txt = texto.toUpperCase();
    return PALAVRAS_BANIDAS.some(palavra => txt.includes(palavra));
}

function validarSenhaAdmin(senhaDigitada) {
    const senhaSalva = localStorage.getItem('gh_ata_admin_pass') || 'admin123';
    return senhaDigitada === senhaSalva;
}

function mascararCelular(valor) {
    return valor.replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d)(\d{4})$/, '$1-$2')
        .slice(0, 15);
}

function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function salvarDadosLocais() {
    localStorage.setItem('gh_ata_dados', JSON.stringify(participantes));
}

function carregarDadosLocais() {
    const localData = localStorage.getItem('gh_ata_dados');
    if (localData) {
        participantes = JSON.parse(localData);
    }
}

function carregarConfiguracoes() {
    const savedConfig = localStorage.getItem('gh_ata_config');
    if (savedConfig) {
        githubConfig = JSON.parse(savedConfig);
        if (document.getElementById('cfgUser')) {
            document.getElementById('cfgUser').value = githubConfig.user || '';
            document.getElementById('cfgRepo').value = githubConfig.repo || '';
            document.getElementById('cfgBranch').value = githubConfig.branch || 'main';
            document.getElementById('cfgPath').value = githubConfig.path || 'presencas.json';
            document.getElementById('cfgToken').value = githubConfig.token || '';
        }
    }

    const savedReuniao = localStorage.getItem('gh_ata_reuniao');
    if (savedReuniao) {
        reuniaoInfo = JSON.parse(savedReuniao);
        if (document.getElementById('cfgTemaReuniao')) {
            document.getElementById('cfgTemaReuniao').value = reuniaoInfo.tema || '';
            document.getElementById('cfgLocalReuniao').value = reuniaoInfo.local || '';
            document.getElementById('cfgDataReuniao').value = reuniaoInfo.data || '';
            document.getElementById('cfgHorarioReuniao').value = reuniaoInfo.horario || '';
        }
    }
}

function salvarConfiguracoes(e) {
    if (e && e.preventDefault) e.preventDefault();
    githubConfig = {
        user: document.getElementById('cfgUser').value.trim(),
        repo: document.getElementById('cfgRepo').value.trim(),
        branch: document.getElementById('cfgBranch').value.trim() || 'main',
        path: document.getElementById('cfgPath').value.trim() || 'presencas.json',
        token: document.getElementById('cfgToken').value.trim()
    };

    if (document.getElementById('cfgTemaReuniao')) {
        reuniaoInfo = {
            tema: document.getElementById('cfgTemaReuniao').value.trim().toUpperCase() || 'ATA DE PRESENÇA DA REUNIÃO',
            local: document.getElementById('cfgLocalReuniao').value.trim().toUpperCase(),
            data: document.getElementById('cfgDataReuniao').value,
            horario: document.getElementById('cfgHorarioReuniao').value
        };
        localStorage.setItem('gh_ata_reuniao', JSON.stringify(reuniaoInfo));
    }

    localStorage.setItem('gh_ata_config', JSON.stringify(githubConfig));
    alert('CONFIGURAÇÕES SALVAS COM SUCESSO!');
    location.reload();
}

async function carregarDadosGitHub() {
    if (!githubConfig.user || !githubConfig.repo) return;
    const url = `https://api.github.com/repos/${githubConfig.user}/${githubConfig.repo}/contents/${githubConfig.path}?ref=${githubConfig.branch}`;

    try {
        const headers = githubConfig.token ? { 'Authorization': `token ${githubConfig.token}` } : {};
        const res = await fetch(url, { headers });

        if (res.ok) {
            const fileData = await res.json();
            const content = decodeURIComponent(escape(atob(fileData.content)));
            const githubParticipantes = JSON.parse(content);

            if (Array.isArray(githubParticipantes)) {
                participantes = githubParticipantes;
                salvarDadosLocais();
            }
        }
    } catch (err) {
        console.warn("NÃO FOI POSSÍVEL CARREGAR VIA GITHUB API. MANTENDO DADOS LOCAIS:", err);
    }
}

async function salvarDadosNoGitHub() {
    const url = `https://api.github.com/repos/${githubConfig.user}/${githubConfig.repo}/contents/${githubConfig.path}`;
    try {
        let sha = "";
        const resGet = await fetch(`${url}?ref=${githubConfig.branch}`, {
            headers: { 'Authorization': `token ${githubConfig.token}` }
        });

        if (resGet.ok) {
            const dataGet = await resGet.json();
            sha = dataGet.sha;
        }

        const contentJson = JSON.stringify(participantes, null, 2);
        const contentBase64 = btoa(unescape(encodeURIComponent(contentJson)));

        await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `ATA DE PRESENÇA ATUALIZADA: ${participantes.length} PARTICIPANTE(S)`,
                content: contentBase64,
                sha: sha !== "" ? sha : undefined,
                branch: githubConfig.branch
            })
        });
    } catch (err) {
        console.error("FALHA NA COMUNICAÇÃO COM O GITHUB:", err);
    }
}

function exportarExcel() {
    if (participantes.length === 0) {
        alert("NÃO HÁ DADOS DE PARTICIPANTES REGISTRADOS PARA EXPORTAR.");
        return;
    }

    let dataFormatada = reuniaoInfo.data ? reuniaoInfo.data.split('-').reverse().join('/') : '';

    const cabecalhoReuniao = [
        ["TEMA DA REUNIÃO:", reuniaoInfo.tema || "ATA DE PRESENÇA DA REUNIÃO"],
        ["LOCAL:", reuniaoInfo.local || "NÃO INFORMADO"],
        ["DATA DA REUNIÃO:", dataFormatada || "NÃO INFORMADA"],
        ["HORÁRIO:", reuniaoInfo.horario || "NÃO INFORMADO"],
        ["TOTAL DE PARTICIPANTES:", participantes.length],
        []
    ];

    const dadosExcel = participantes.map((p, index) => ({
        "Nº": index + 1,
        "NOME COMPLETO": p.nome,
        "SETOR / DEPARTAMENTO": p.setor,
        "EMPRESA": p.empresa,
        "E-MAIL": p.email,
        "CELULAR / WHATSAPP": p.celular,
        "DATA E HORA DO REGISTRO": p.dataHora
    }));

    const ws = XLSX.utils.aoa_to_sheet(cabecalhoReuniao);
    XLSX.utils.sheet_add_json(ws, dadosExcel, { origin: "A7" });

    ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ATA DE PRESENÇA");
    XLSX.writeFile(wb, `ATA_PRESENCA_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportarPDF() {
    if (participantes.length === 0) {
        alert("NÃO HÁ DADOS PARA GERAR O PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let startYPosition = 20;
    let textXPosition = 14;

    const imgElement = document.getElementById('imgLogoHeader');
    if (imgElement && imgElement.complete && imgElement.naturalWidth !== 0) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgElement, 0, 0);
            const imgData = canvas.toDataURL('image/png');
            
            doc.addImage(imgData, 'PNG', 14, 10, 40, 18);
            textXPosition = 60;
        } catch (e) {
            console.warn("NÃO FOI POSSÍVEL CARREGAR A IMAGEM NO PDF:", e);
        }
    }

    let dataFormatada = reuniaoInfo.data ? reuniaoInfo.data.split('-').reverse().join('/') : '';

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(reuniaoInfo.tema || "ATA DE PRESENÇA DA REUNIÃO", textXPosition, startYPosition);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    startYPosition += 6;
    if (reuniaoInfo.local) {
        doc.text(`LOCAL: ${reuniaoInfo.local}`, textXPosition, startYPosition);
        startYPosition += 5;
    }
    if (dataFormatada || reuniaoInfo.horario) {
        doc.text(`DATA: ${dataFormatada || 'N/I'} | HORÁRIO: ${reuniaoInfo.horario || 'N/I'}`, textXPosition, startYPosition);
        startYPosition += 5;
    }
    doc.text(`TOTAL DE PARTICIPANTES: ${participantes.length}`, textXPosition, startYPosition);

    const tableRows = participantes.map((p, i) => [
        i + 1,
        p.nome,
        p.setor,
        p.empresa,
        p.email,
        p.celular,
        p.dataHora
    ]);

    doc.autoTable({
        startY: Math.max(startYPosition + 8, 35),
        head: [['#', 'NOME', 'SETOR', 'EMPRESA', 'E-MAIL', 'CELULAR', 'HORÁRIO']],
        body: tableRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 0, 0] }
    });

    doc.save(`ATA_PRESENCA_${new Date().toISOString().split('T')[0]}.pdf`);
}

function escapeHtml(str) {
    return str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : '';
}