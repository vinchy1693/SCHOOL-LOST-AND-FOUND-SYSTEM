-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 22, 2026 at 09:38 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `lost_and_found_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `category`
--

CREATE TABLE `category` (
  `category_id` int(11) NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `category`
--

INSERT INTO `category` (`category_id`, `category_name`, `description`) VALUES
(1, 'School ID', NULL),
(2, 'Phone', NULL),
(3, 'Wallet', NULL),
(4, 'Keys', NULL),
(5, 'Bag', NULL),
(6, 'Umbrella', NULL),
(7, 'Tumbler', NULL),
(8, 'Calculator', NULL),
(9, 'Uniform', NULL),
(10, 'Books', NULL),
(11, 'Other', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `claim`
--

CREATE TABLE `claim` (
  `claim_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `claimant_id` int(11) NOT NULL,
  `lost_report_id` int(11) DEFAULT NULL,
  `description_provided` text NOT NULL,
  `claim_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `claim_evidence`
--

CREATE TABLE `claim_evidence` (
  `claim_evidence_id` int(11) NOT NULL,
  `claim_id` int(11) NOT NULL,
  `evidence_type` enum('photo','receipt','id','serial_number','other') NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `department`
--

CREATE TABLE `department` (
  `department_id` int(11) NOT NULL,
  `department_name` varchar(100) NOT NULL,
  `department_code` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `disposal`
--

CREATE TABLE `disposal` (
  `disposal_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `approved_by` int(11) NOT NULL,
  `disposal_method` enum('donated','recycled','discarded') NOT NULL,
  `donated_to` varchar(150) DEFAULT NULL,
  `disposed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `remarks` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item`
--

CREATE TABLE `item` (
  `item_id` int(11) NOT NULL,
  `item_code` varchar(30) NOT NULL,
  `category_id` int(11) NOT NULL,
  `found_location_id` int(11) NOT NULL,
  `storage_location_id` int(11) DEFAULT NULL,
  `reported_by` int(11) NOT NULL,
  `title` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `found_id_number` varchar(30) DEFAULT NULL,
  `date_found` date NOT NULL,
  `status` enum('found','in_storage','claimed','returned','disposed') NOT NULL DEFAULT 'found',
  `is_valuable` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item_image`
--

CREATE TABLE `item_image` (
  `item_image_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item_match`
--

CREATE TABLE `item_match` (
  `item_match_id` int(11) NOT NULL,
  `lost_report_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `matched_by` int(11) DEFAULT NULL,
  `match_score` decimal(5,2) DEFAULT NULL,
  `match_status` enum('suggested','confirmed','rejected') NOT NULL DEFAULT 'suggested',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item_return`
--

CREATE TABLE `item_return` (
  `item_return_id` int(11) NOT NULL,
  `claim_id` int(11) NOT NULL,
  `released_by` int(11) NOT NULL,
  `received_by_name` varchar(150) NOT NULL,
  `id_presented` varchar(50) NOT NULL,
  `returned_at` datetime NOT NULL DEFAULT current_timestamp(),
  `signature_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item_status_history`
--

CREATE TABLE `item_status_history` (
  `item_status_history_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `changed_by` int(11) NOT NULL,
  `old_status` enum('found','in_storage','claimed','returned','disposed') DEFAULT NULL,
  `new_status` enum('found','in_storage','claimed','returned','disposed') NOT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `location`
--

CREATE TABLE `location` (
  `location_id` int(11) NOT NULL,
  `location_name` varchar(100) NOT NULL,
  `location_type` enum('found_spot','storage') NOT NULL DEFAULT 'found_spot',
  `building` varchar(100) DEFAULT NULL,
  `room` varchar(50) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `lost_report`
--

CREATE TABLE `lost_report` (
  `lost_report_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `title` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `last_seen_location` varchar(150) DEFAULT NULL,
  `date_lost` date NOT NULL,
  `status` enum('open','matched','closed') NOT NULL DEFAULT 'open',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification`
--

CREATE TABLE `notification` (
  `notification_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `notification_type` enum('item_found','match_found','claim_update','item_returned','general') NOT NULL DEFAULT 'general',
  `message` text NOT NULL,
  `related_item_id` int(11) DEFAULT NULL,
  `related_claim_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `sent_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `role`
--

CREATE TABLE `role` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role`
--

INSERT INTO `role` (`role_id`, `role_name`, `description`) VALUES
(1, 'admin', 'System administrator'),
(2, 'staff', 'Guard or discipline office staff'),
(3, 'user', 'Student, faculty, or other regular user');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `department_id` int(11) DEFAULT NULL,
  `user_type` enum('student','faculty','staff','guest') NOT NULL DEFAULT 'student',
  `id_number` varchar(30) DEFAULT NULL,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `year_level` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `category`
--
ALTER TABLE `category`
  ADD PRIMARY KEY (`category_id`),
  ADD UNIQUE KEY `category_name` (`category_name`);

--
-- Indexes for table `claim`
--
ALTER TABLE `claim`
  ADD PRIMARY KEY (`claim_id`),
  ADD KEY `idx_claim_status` (`claim_status`),
  ADD KEY `fk_claim_item` (`item_id`),
  ADD KEY `fk_claim_claimant` (`claimant_id`),
  ADD KEY `fk_claim_lost` (`lost_report_id`),
  ADD KEY `fk_claim_reviewer` (`reviewed_by`);

--
-- Indexes for table `claim_evidence`
--
ALTER TABLE `claim_evidence`
  ADD PRIMARY KEY (`claim_evidence_id`),
  ADD KEY `fk_evidence_claim` (`claim_id`);

--
-- Indexes for table `department`
--
ALTER TABLE `department`
  ADD PRIMARY KEY (`department_id`),
  ADD UNIQUE KEY `department_code` (`department_code`);

--
-- Indexes for table `disposal`
--
ALTER TABLE `disposal`
  ADD PRIMARY KEY (`disposal_id`),
  ADD UNIQUE KEY `item_id` (`item_id`),
  ADD KEY `fk_disposal_user` (`approved_by`);

--
-- Indexes for table `item`
--
ALTER TABLE `item`
  ADD PRIMARY KEY (`item_id`),
  ADD UNIQUE KEY `item_code` (`item_code`),
  ADD KEY `idx_item_status` (`status`),
  ADD KEY `idx_item_date_found` (`date_found`),
  ADD KEY `idx_item_found_id_number` (`found_id_number`),
  ADD KEY `fk_item_category` (`category_id`),
  ADD KEY `fk_item_found_location` (`found_location_id`),
  ADD KEY `fk_item_storage_location` (`storage_location_id`),
  ADD KEY `fk_item_reported_by` (`reported_by`);

--
-- Indexes for table `item_image`
--
ALTER TABLE `item_image`
  ADD PRIMARY KEY (`item_image_id`),
  ADD KEY `fk_item_image_item` (`item_id`);

--
-- Indexes for table `item_match`
--
ALTER TABLE `item_match`
  ADD PRIMARY KEY (`item_match_id`),
  ADD UNIQUE KEY `uq_match_pair` (`lost_report_id`,`item_id`),
  ADD KEY `fk_match_item` (`item_id`),
  ADD KEY `fk_match_user` (`matched_by`);

--
-- Indexes for table `item_return`
--
ALTER TABLE `item_return`
  ADD PRIMARY KEY (`item_return_id`),
  ADD UNIQUE KEY `claim_id` (`claim_id`),
  ADD KEY `fk_return_user` (`released_by`);

--
-- Indexes for table `item_status_history`
--
ALTER TABLE `item_status_history`
  ADD PRIMARY KEY (`item_status_history_id`),
  ADD KEY `idx_history_item` (`item_id`,`changed_at`),
  ADD KEY `fk_history_user` (`changed_by`);

--
-- Indexes for table `location`
--
ALTER TABLE `location`
  ADD PRIMARY KEY (`location_id`);

--
-- Indexes for table `lost_report`
--
ALTER TABLE `lost_report`
  ADD PRIMARY KEY (`lost_report_id`),
  ADD KEY `idx_lost_status` (`status`),
  ADD KEY `fk_lost_user` (`user_id`),
  ADD KEY `fk_lost_category` (`category_id`);

--
-- Indexes for table `notification`
--
ALTER TABLE `notification`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `idx_notif_user_read` (`user_id`,`is_read`),
  ADD KEY `fk_notif_item` (`related_item_id`),
  ADD KEY `fk_notif_claim` (`related_claim_id`);

--
-- Indexes for table `role`
--
ALTER TABLE `role`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `role_name` (`role_name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `id_number` (`id_number`),
  ADD KEY `fk_users_role` (`role_id`),
  ADD KEY `fk_users_department` (`department_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `category`
--
ALTER TABLE `category`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `claim`
--
ALTER TABLE `claim`
  MODIFY `claim_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `claim_evidence`
--
ALTER TABLE `claim_evidence`
  MODIFY `claim_evidence_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `department`
--
ALTER TABLE `department`
  MODIFY `department_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `disposal`
--
ALTER TABLE `disposal`
  MODIFY `disposal_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item`
--
ALTER TABLE `item`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item_image`
--
ALTER TABLE `item_image`
  MODIFY `item_image_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item_match`
--
ALTER TABLE `item_match`
  MODIFY `item_match_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item_return`
--
ALTER TABLE `item_return`
  MODIFY `item_return_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item_status_history`
--
ALTER TABLE `item_status_history`
  MODIFY `item_status_history_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `location`
--
ALTER TABLE `location`
  MODIFY `location_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `lost_report`
--
ALTER TABLE `lost_report`
  MODIFY `lost_report_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notification`
--
ALTER TABLE `notification`
  MODIFY `notification_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `role`
--
ALTER TABLE `role`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `claim`
--
ALTER TABLE `claim`
  ADD CONSTRAINT `fk_claim_claimant` FOREIGN KEY (`claimant_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_claim_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_claim_lost` FOREIGN KEY (`lost_report_id`) REFERENCES `lost_report` (`lost_report_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_claim_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `claim_evidence`
--
ALTER TABLE `claim_evidence`
  ADD CONSTRAINT `fk_evidence_claim` FOREIGN KEY (`claim_id`) REFERENCES `claim` (`claim_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `disposal`
--
ALTER TABLE `disposal`
  ADD CONSTRAINT `fk_disposal_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_disposal_user` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE;

--
-- Constraints for table `item`
--
ALTER TABLE `item`
  ADD CONSTRAINT `fk_item_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_item_found_location` FOREIGN KEY (`found_location_id`) REFERENCES `location` (`location_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_item_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_item_storage_location` FOREIGN KEY (`storage_location_id`) REFERENCES `location` (`location_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `item_image`
--
ALTER TABLE `item_image`
  ADD CONSTRAINT `fk_item_image_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `item_match`
--
ALTER TABLE `item_match`
  ADD CONSTRAINT `fk_match_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_match_lost` FOREIGN KEY (`lost_report_id`) REFERENCES `lost_report` (`lost_report_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_match_user` FOREIGN KEY (`matched_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `item_return`
--
ALTER TABLE `item_return`
  ADD CONSTRAINT `fk_return_claim` FOREIGN KEY (`claim_id`) REFERENCES `claim` (`claim_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_return_user` FOREIGN KEY (`released_by`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE;

--
-- Constraints for table `item_status_history`
--
ALTER TABLE `item_status_history`
  ADD CONSTRAINT `fk_history_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE;

--
-- Constraints for table `lost_report`
--
ALTER TABLE `lost_report`
  ADD CONSTRAINT `fk_lost_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_lost_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE;

--
-- Constraints for table `notification`
--
ALTER TABLE `notification`
  ADD CONSTRAINT `fk_notif_claim` FOREIGN KEY (`related_claim_id`) REFERENCES `claim` (`claim_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notif_item` FOREIGN KEY (`related_item_id`) REFERENCES `item` (`item_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
