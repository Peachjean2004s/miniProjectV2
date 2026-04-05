// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LonganSupplyChain {

    // ==========================================
    // Types
    // ==========================================

    enum Role { None, Orchard, PackingHouse, Transporter, Retailer }
    enum Status { Harvested, ReceivedByPackingHouse, InTransit, ReceivedByRetailer, Sold }

    struct LonganLot {
        uint256 lotId;
        string variety;
        uint256 weightKg;
        address orchard;     
        address currentOwner;
        address nextOwner;
        Status status;
        uint256 createdAt;    
    }

    // ==========================================
    // State — เก็บเฉพาะสิ่งที่ต้อง verify on-chain
    // ==========================================

    mapping(address => Role) public userRoles;       // role ของแต่ละ address
    mapping(address => bool) public isRegistered;    // ลงทะเบียนแล้วหรือยัง
    mapping(uint256 => LonganLot) private lots;
    uint256 public lotCounter;

    // ==========================================
    // Events — transaction history on-chain
    // ==========================================

    event RoleRegistered(
        address indexed user,
        Role indexed role,
        uint256 timestamp
    );
    event LotRegistered(
        uint256 indexed lotId,
        address indexed orchard,
        string variety,
        uint256 weightKg,
        uint256 timestamp
    );
    event HandshakeInitiated(
        uint256 indexed lotId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
    event HandshakeCompleted(
        uint256 indexed lotId,
        address indexed newOwner,
        Status newStatus,
        uint256 timestamp
    );
    event LotSold(
        uint256 indexed lotId,
        address indexed retailer,
        uint256 timestamp
    );

    // ==========================================
    // Modifiers
    // ==========================================

    modifier onlyRole(Role _role) {
        require(userRoles[msg.sender] == _role, "Unauthorized: Incorrect role");
        _;
    }

    modifier onlyCurrentOwner(uint256 _lotId) {
        require(lots[_lotId].currentOwner == msg.sender, "Unauthorized: Not the current owner");
        _;
    }

    modifier lotExists(uint256 _lotId) {
        require(_lotId > 0 && _lotId <= lotCounter, "Error: Lot does not exist");
        _;
    }

    // ==========================================
    // Registration — role ทำได้ครั้งเดียว เปลี่ยนไม่ได้
    // ข้อมูล profile อื่นๆ เก็บใน database ไม่ขึ้น blockchain
    // ==========================================

    function registerSelf(Role _role) external {
        require(_role != Role.None, "Invalid role");
        require(!isRegistered[msg.sender], "Already registered - role is immutable");

        userRoles[msg.sender] = _role;
        isRegistered[msg.sender] = true;

        emit RoleRegistered(msg.sender, _role, block.timestamp);
    }

    // ==========================================
    // Supply Chain
    // ==========================================

    function registerLot(
        string calldata _variety,
        uint256 _weightKg
    ) external onlyRole(Role.Orchard) {
        require(_weightKg > 0, "Weight must be > 0");
        require(bytes(_variety).length > 0, "Variety required");

        lotCounter++;
        lots[lotCounter] = LonganLot({
            lotId: lotCounter,
            variety: _variety,
            weightKg: _weightKg,
            orchard: msg.sender,
            currentOwner: msg.sender,
            nextOwner: address(0),
            status: Status.Harvested,
            createdAt: block.timestamp
        });

        emit LotRegistered(lotCounter, msg.sender, _variety, _weightKg, block.timestamp);
    }

    function initiateTransfer(
        uint256 _lotId,
        address _to
    ) external lotExists(_lotId) onlyCurrentOwner(_lotId) {
        require(_to != address(0), "Invalid target address");
        require(_to != msg.sender, "Cannot transfer to yourself");
        require(lots[_lotId].status != Status.Sold, "Lot is already sold");
        require(lots[_lotId].nextOwner == address(0), "Transfer already pending");
        require(isRegistered[_to], "Receiver not registered");

        Role myRole = userRoles[msg.sender];
        Role targetRole = userRoles[_to];

        if (myRole == Role.Orchard) {
            require(targetRole == Role.PackingHouse, "Orchard must send to PackingHouse");
        } else if (myRole == Role.PackingHouse) {
            require(targetRole == Role.Transporter, "PackingHouse must send to Transporter");
        } else if (myRole == Role.Transporter) {
            require(targetRole == Role.Retailer, "Transporter must send to Retailer");
        } else {
            revert("Invalid transfer flow");
        }

        lots[_lotId].nextOwner = _to;
        emit HandshakeInitiated(_lotId, msg.sender, _to, block.timestamp);
    }

    function receiveLot(uint256 _lotId) external lotExists(_lotId) {
        require(lots[_lotId].nextOwner == msg.sender, "You are not the designated receiver");
        require(lots[_lotId].status != Status.Sold, "Lot is already sold");

        Role myRole = userRoles[msg.sender];
        Status newStatus;

        if (myRole == Role.PackingHouse) {
            newStatus = Status.ReceivedByPackingHouse;
        } else if (myRole == Role.Transporter) {
            newStatus = Status.InTransit;
        } else if (myRole == Role.Retailer) {
            newStatus = Status.ReceivedByRetailer;
        } else {
            revert("Invalid receiver role");
        }

        lots[_lotId].currentOwner = msg.sender;
        lots[_lotId].nextOwner = address(0);
        lots[_lotId].status = newStatus;

        emit HandshakeCompleted(_lotId, msg.sender, newStatus, block.timestamp);
    }

    function sellLot(uint256 _lotId)
        external
        lotExists(_lotId)
        onlyRole(Role.Retailer)
        onlyCurrentOwner(_lotId)
    {
        require(lots[_lotId].status == Status.ReceivedByRetailer, "Lot not at Retailer yet");

        lots[_lotId].status = Status.Sold;
        emit LotSold(_lotId, msg.sender, block.timestamp);
    }

    // ==========================================
    // View functions
    // ==========================================

    function getLotInfo(uint256 _lotId) external view lotExists(_lotId) returns (LonganLot memory) {
        return lots[_lotId];
    }

    function getRole(address _user) external view returns (Role) {
        return userRoles[_user];
    }
}