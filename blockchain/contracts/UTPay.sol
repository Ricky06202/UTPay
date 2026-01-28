// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title UTPay
 * @dev Contrato para la gestión de pagos universitarios vinculados a la identidad del estudiante.
 * Implementa un modelo de "Abstracción de Identidad" donde el saldo reside en el ID (correo)
 * y no en la dirección de la billetera directamente.
 */
contract UTPay {
    mapping(address => bool) public admins;
    string public name = "UTPay University Token";
    string public symbol = "UTP";
    uint8 public decimals = 2;

    struct Student {
        string email;
        address wallet;
        uint256 balance;
        bool isRegistered;
    }

    // Mapping de Correo -> Información del Estudiante
    mapping(string => Student) public students;
    // Mapping de Billetera -> Correo (para saber quién firma)
    mapping(address => string) public walletToEmail;
    
    // --- NUEVAS VARIABLES: SISTEMA DE MÉRITO Y CRÉDITO ---
    mapping(string => uint256) public creditScore; // Score de 0 a 100 vinculado al correo
    mapping(string => uint256) public activeLoans; // Préstamos activos por correo
    uint256 public loanFund;                       // Fondo total disponible para préstamos

    event Transfer(string fromEmail, string toEmail, uint256 amount, string metadata);
    event WalletUpdated(string email, address oldWallet, address newWallet);
    event StudentRegistered(string email, address wallet);
    event Mint(string email, uint256 amount);
    event Burn(string email, uint256 amount);
    
    // Eventos del Sistema de Crédito
    event ScoreUpdated(string email, uint256 newScore);
    event LoanRequested(string email, uint256 amount);
    event LoanPaid(string email, uint256 amount);
    event DonationReceived(address donor, uint256 amount);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    constructor() {
        admins[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Solo la Universidad puede ejecutar esto");
        _;
    }

    /**
     * @dev Añade un nuevo administrador (Solo Admin actual).
     */
    function addAdmin(address _newAdmin) public onlyAdmin {
        require(_newAdmin != address(0), "Direccion invalida");
        admins[_newAdmin] = true;
        emit AdminAdded(_newAdmin);
    }

    /**
     * @dev Elimina un administrador (Solo Admin actual).
     */
    function removeAdmin(address _admin) public onlyAdmin {
        require(_admin != msg.sender, "No puedes eliminarte a ti mismo");
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    // --- FUNCIONES DEL SISTEMA DE MÉRITO Y CRÉDITO ---

    /**
     * @dev Actualiza el Credit Score de un estudiante (Solo Admin).
     * El score debe ser calculado en el backend basado en índice, running y horas sociales.
     */
    function updateCreditScore(string memory _email, uint256 _newScore) public onlyAdmin {
        require(students[_email].isRegistered, "Estudiante no registrado");
        require(_newScore <= 100, "El score no puede ser mayor a 100");
        creditScore[_email] = _newScore;
        emit ScoreUpdated(_email, _newScore);
    }

    /**
     * @dev Permite a empresas o individuos donar al fondo de préstamos.
     * En una red privada con tokens personalizados, esto requiere que el admin 
     * transfiera los tokens al fondo (o use una billetera de tesorería).
     */
    function donateToFund(uint256 _amount) public {
        string memory donorEmail = walletToEmail[msg.sender];
        require(bytes(donorEmail).length > 0, "Donante debe estar registrado");
        require(students[donorEmail].balance >= _amount, "Saldo insuficiente para donar");

        students[donorEmail].balance -= _amount;
        loanFund += _amount;

        emit DonationReceived(msg.sender, _amount);
    }

    /**
     * @dev Un estudiante solicita un micro-crédito basado en su mérito.
     */
    function requestLoan(uint256 _amount) public {
        string memory email = walletToEmail[msg.sender];
        require(bytes(email).length > 0, "Estudiante no registrado");
        require(creditScore[email] >= 80, "Merito insuficiente (Score < 80)");
        require(_amount <= loanFund, "No hay suficientes fondos en el sistema");
        require(activeLoans[email] == 0, "Ya tienes un prestamo activo");

        loanFund -= _amount;
        students[email].balance += _amount;
        activeLoans[email] = _amount;

        emit LoanRequested(email, _amount);
    }

    /**
     * @dev El estudiante devuelve el préstamo para mejorar su reputación.
     */
    function payLoan() public {
        string memory email = walletToEmail[msg.sender];
        uint256 debt = activeLoans[email];
        require(debt > 0, "No tienes deudas pendientes");
        require(students[email].balance >= debt, "Saldo insuficiente para pagar");

        students[email].balance -= debt;
        loanFund += debt;
        activeLoans[email] = 0;

        // Bono de mérito por pagar a tiempo (opcional, se puede manejar en backend)
        if (creditScore[email] < 100) {
            creditScore[email] += 2;
            if (creditScore[email] > 100) creditScore[email] = 100;
        }

        emit LoanPaid(email, debt);
    }

    /**
     * @dev Registra un nuevo estudiante en el sistema.
     */
    function registerStudent(string memory _email, address _wallet) public onlyAdmin {
        require(!students[_email].isRegistered, "Estudiante ya registrado");
        require(bytes(walletToEmail[_wallet]).length == 0, "Billetera ya vinculada a otro correo");

        students[_email] = Student(_email, _wallet, 0, true);
        walletToEmail[_wallet] = _email;

        emit StudentRegistered(_email, _wallet);
    }

    /**
     * @dev Permite a la administración actualizar la billetera de un estudiante (Recuperación).
     */
    function updateWallet(string memory _email, address _newWallet) public onlyAdmin {
        require(students[_email].isRegistered, "Estudiante no existe");
        require(bytes(walletToEmail[_newWallet]).length == 0, "Nueva billetera ya esta en uso");

        address oldWallet = students[_email].wallet;
        
        // Limpiar vínculo anterior
        delete walletToEmail[oldWallet];
        
        // Actualizar a nueva billetera
        students[_email].wallet = _newWallet;
        walletToEmail[_newWallet] = _email;

        emit WalletUpdated(_email, oldWallet, _newWallet);
    }

    /**
     * @dev Carga saldo a un estudiante (ej: becas, depósitos en caja).
     */
    function mint(string memory _email, uint256 _amount) public onlyAdmin {
        require(students[_email].isRegistered, "Estudiante no existe");
        students[_email].balance += _amount;
        
        emit Mint(_email, _amount);
    }

    /**
     * @dev Elimina saldo de un estudiante (ej: corrección de errores, multas, pagos presenciales).
     */
    function burn(string memory _email, uint256 _amount) public onlyAdmin {
        require(students[_email].isRegistered, "Estudiante no existe");
        require(students[_email].balance >= _amount, "Saldo insuficiente para eliminar");
        
        students[_email].balance -= _amount;
        
        emit Burn(_email, _amount);
    }

    /**
     * @dev Transfiere UTP entre estudiantes usando sus correos.
     */
    function transferByEmail(string memory _toEmail, uint256 _amount, string memory _metadata) public {
        string memory fromEmail = walletToEmail[msg.sender];
        require(bytes(fromEmail).length > 0, "Emisor no registrado en el sistema");
        require(students[_toEmail].isRegistered, "Receptor no registrado");
        require(students[fromEmail].balance >= _amount, "Saldo insuficiente");

        students[fromEmail].balance -= _amount;
        students[_toEmail].balance += _amount;

        emit Transfer(fromEmail, _toEmail, _amount, _metadata);
    }

    /**
     * @dev Consulta el saldo de un estudiante por su correo.
     */
    function getBalance(string memory _email) public view returns (uint256) {
        return students[_email].balance;
    }

    /**
     * @dev Obtiene el correo vinculado a una billetera.
     */
    function getEmailByWallet(address _wallet) public view returns (string memory) {
        return walletToEmail[_wallet];
    }
}
